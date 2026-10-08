/**
 * Verify seam: deterministic screens (noise, unknown ids, quote-in-excerpt, hedges, alias contradictions, duplicates), then a second model that may only downgrade.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/verify.ts
 * Deps:    zod, src/domain/corroborate (fold, hasWord, orgTokens), src/domain/cv-check, src/domain/similar (nearDuplicate), src/recipe/seams/resolve (confirmedSources)
 * Tested:  src/recipe/__tests__/verify.test.ts, src/recipe/__tests__/cv-consistency.test.ts (CV check)
 *
 * Key responsibilities:
 * - Support ids outside confirmedSources (unknown, unverified, under a rejected profile) are dropped; a claim left
 *   with no support is dropped (never shown without a source)
 * - FACT keeps its kind only if the normalised quote is inside one cited excerpt (after unknown ids are dropped)
 * - `cv-consistency` FACT (a CV statement the public record matches) keeps its kind only if the quote is inside a cited
 *   PUBLIC excerpt: a quote found only in the CV itself proves nothing and is downgraded ("quote only in the CV")
 * - FACT with hedged wording ("likely", "may", "pravděpodobně", ...) becomes INFERENCE, note "hedged wording"
 * - screenClaims (shared with synthesize): drops self-declared noise ("unrelated content", "misattributed") and
 *   contradiction claims that call themselves compatible / not a contradiction (saysCompatible); a contradiction claim
 *   naming two aliases of one organisation ("A | B", "A (formerly B)", "A, formerly B" in a source, both sides
 *   organisation-like) is kept as INFERENCE ranked last with ALIAS_MARK in its text
 * - screenClaims also drops a `cv-consistency` claim that judges the person (JUDGEMENT: fake, lie, inflated, …): a
 *   difference is a question, never a verdict
 * - mergeDuplicates: claims with the same question_id whose folded texts are equal or token Jaccard >= 0.8
 *   (src/domain/similar) merge into the better-ranked / higher-confidence one, supports unioned, note
 *   "merged duplicate: <id>"
 * - Residue (FACTs that passed) goes to the verify model; "not supported" downgrades to INFERENCE
 *
 * Design constraints:
 * - Downgrade or drop only, never promote; an LLM failure keeps the deterministic result
 * - Returns the full claim list (claims_mode = replace)
 */
import { z } from "zod";
import type { Claim, Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { fold, hasWord, orgTokens } from "@/domain/corroborate";
import { CV_QUESTION_ID, isCvSource } from "@/domain/cv-check";
import { normalizeText, quoteInNormalized } from "@/domain/quote";
import { nearDuplicate } from "@/domain/similar";
import { emptyOutcome } from "@/recipe/runner";
import { confirmedSources } from "@/recipe/seams/resolve";
import type { StepContext, StepOutcome } from "@/recipe/sources/types";

/** The seam's name for the shared normaliser (src/domain/quote.ts): FACT and STATEMENT share one gate. */
export const normalise = normalizeText;

export function quoteSupported(claim: Claim, sources: readonly Source[]): boolean {
  if (claim.quote === null) return false;
  const quote = claim.quote;
  const byId = new Map(sources.map((s) => [s.id, s]));
  return (
    claim.supports.every((id) => byId.has(id)) &&
    claim.supports.some((id) => quoteInNormalized(quote, normalizeText(byId.get(id)?.excerpt ?? "")))
  );
}

/** A `cv-consistency` FACT must quote a public source it cites; the CV agreeing with itself is no match. */
export function cvQuoteSupported(claim: Claim, sources: readonly Source[]): boolean {
  const publicIds = new Set(sources.filter((s) => !isCvSource(s)).map((s) => s.id));
  return quoteSupported(claim, sources) && quoteSupported({ ...claim, supports: claim.supports.filter((id) => publicIds.has(id)) }, sources);
}

function downgrade(claim: Claim): Claim {
  return { ...claim, kind: "INFERENCE", confidence: Math.min(claim.confidence, 0.5) };
}

/** Claim texts the extractor itself flags as noise: such content is ignored, never shown. */
const NOISE = /unrelated content|misattributed|appears to be unrelated/i;
/** Hedges: speculation is never a FACT. "may" only in lower case, so the month "May 2019" stays a fact. */
const HEDGE = /(?<!\p{L})(?:likely|probably|possibly|might|appears to|seems|presumably|pravděpodobně|zřejmě|asi)(?!\p{L})/iu;
const HEDGE_MAY = /(?<!\p{L})may(?!\p{L})/u;
/** Words that judge the candidate instead of describing a source: never allowed in a CV check claim. */
const JUDGEMENT = /(?<!\p{L})(?:fake\w*|lie|lies|lied|lying|liar|inflat\w*|dishonest\w*|suspicious\w*|fraud\w*|fabricat\w*|untrustworthy)(?!\p{L})/iu;

export function hedged(text: string): boolean {
  return HEDGE.test(text) || HEDGE_MAY.test(text);
}

/** Wording of a "contradiction" that says it is none: "over 13 years" vs "15 years" agrees within the rounding. */
const COMPATIBLE = /compatible|not a contradiction|no contradiction|not incompatible|consistent with/i;

/** True when a text (claim or model summary) states the sources agree, so it is no contradiction. */
export function saysCompatible(text: string): boolean {
  return COMPATIBLE.test(text);
}

/** A capitalised word; inner dots allowed (Kiwi.com), a sentence-ending dot is not part of it. */
const NAME = String.raw`\p{Lu}[\p{L}\p{N}&'-]*(?:\.[\p{L}\p{N}]+)*`;
const SIDE = String.raw`${NAME}(?:[ \t]+${NAME}){0,2}`;
const PIPE = new RegExp(String.raw`(${SIDE})[ \t]*\|[ \t]*(${SIDE})`, "gu");
const FORMERLY = new RegExp(String.raw`(${SIDE})[ \t]*(?:\(|,)[ \t]*(?:formerly|dříve|now|nyní)[ \t]+(${SIDE})`, "gu");
/** Title separators that join a name with a platform, not two names of one organisation. */
const NOT_ALIAS = new Set(["linkedin", "facebook", "x", "twitter", "instagram", "github", "youtube", "tiktok", "bluesky", "medium", "threads"]);

/** Words that make a side a job title, not an organisation: "Senior Marketing Manager | Groupon" is no alias pair. */
const TITLE_WORD = /(?<![\p{L}\p{N}])(?:manager|director|officer|head|lead|engineer|designer|analyst|consultant|specialist|cmo|ceo|cto|cfo|vp)(?![\p{L}\p{N}])/u;
const MAX_ORG_WORDS = 4;

/** Organisation-like: at most 4 words, no job-title word, and at least one distinctive org token (src/domain/corroborate). */
function orgLike(side: string, subject: string): boolean {
  return side.split(/\s+/).length <= MAX_ORG_WORDS && !TITLE_WORD.test(fold(side)) && orgTokens([side], subject).length > 0;
}

/** Every suffix of the left side and every prefix of the right: "Head Vilgain | Aktin" also yields Vilgain ~ Aktin. */
function sidePairs(left: string, right: string): [string, string][] {
  const l = left.split(/[ \t]+/);
  const r = right.split(/[ \t]+/);
  const pairs: [string, string][] = [];
  for (let i = 0; i < l.length; i++) for (let j = 1; j <= r.length; j++) pairs.push([l.slice(i).join(" "), r.slice(0, j).join(" ")]);
  return pairs;
}

/**
 * Alias pairs ("Vilgain", "Aktin") stated by any source excerpt. Both sides must be organisation-like (orgLike);
 * platform names and the subject's own name never count.
 */
export function aliasPairs(sources: readonly Pick<Source, "excerpt">[], subject = ""): [string, string][] {
  const own = new Set(fold(subject).split(/\s+/).filter(Boolean));
  const usable = (side: string): boolean => side.split(/\s+/).every((w) => !NOT_ALIAS.has(fold(w)) && !own.has(fold(w))) && orgLike(side, subject);
  const out: [string, string][] = [];
  for (const s of sources) {
    for (const re of [PIPE, FORMERLY]) {
      for (const m of s.excerpt.matchAll(re)) {
        for (const [a, b] of sidePairs(m[1] ?? "", m[2] ?? "")) if (usable(a) && usable(b) && fold(a) !== fold(b)) out.push([a, b]);
      }
    }
  }
  return out;
}

/** Whole-word, case- and diacritics-insensitive mention. */
const names = (text: string, name: string): boolean => hasWord(fold(text), fold(name));

/** Marker appended to a contradiction claim that names two aliases: it is kept (never deleted), ranked last. */
export const ALIAS_MARK = "[names aliases of one organisation:";

export function aliasNoted(claim: Pick<Claim, "text">): boolean {
  return claim.text.includes(ALIAS_MARK);
}

/**
 * Noise and false-contradiction screen, shared by verify and synthesize so dropped claims never reach the brief,
 * its interview questions or to_verify. A contradiction naming two aliases is kept as INFERENCE, ranked last, with
 * the alias pair in its text (contradictions via rank, never delete); re-screening it is a no-op.
 */
export function screenClaims(claims: readonly Claim[], sources: readonly Source[], subject: string): { kept: Claim[]; notes: string[] } {
  const notes: string[] = [];
  const aliases = aliasPairs(sources, subject);
  const last = Math.max(0, ...claims.map((c) => c.rank)) + 1;
  const kept = claims.flatMap((c): Claim[] => {
    if (NOISE.test(c.text)) {
      notes.push(`dropped (unrelated or misattributed content): ${c.id}`);
      return [];
    }
    if (c.question_id === CV_QUESTION_ID && JUDGEMENT.test(c.text)) {
      notes.push(`dropped CV check claim (judges the person): ${c.id}`);
      return [];
    }
    if (c.question_id !== "contradictions" || aliasNoted(c)) return [c];
    if (saysCompatible(c.text)) {
      notes.push(`dropped contradiction (compatible statements): ${c.id}`);
      return [];
    }
    const alias = aliases.find(([a, b]) => names(c.text, a) && names(c.text, b));
    if (alias === undefined) return [c];
    notes.push(`ranked last contradiction (aliases of one organisation: ${alias[0]} | ${alias[1]}): ${c.id}`);
    return [{ ...downgrade(c), rank: last, text: `${c.text} ${ALIAS_MARK} ${alias[0]} | ${alias[1]}]` }];
  });
  return { kept, notes };
}

/** Lower rank wins, then higher confidence, then the earlier claim. */
const outranks = (a: Claim, b: Claim): boolean => (a.rank !== b.rank ? a.rank < b.rank : a.confidence >= b.confidence);

/**
 * Merges near-duplicate claims (same question_id, src/domain/similar nearDuplicate): the better one is kept at the
 * earlier position with the union of both supports; note "merged duplicate: <dropped id>".
 */
export function mergeDuplicates(claims: readonly Claim[]): { kept: Claim[]; notes: string[] } {
  const kept: Claim[] = [];
  const notes: string[] = [];
  for (const c of claims) {
    const i = kept.findIndex((k) => k.question_id === c.question_id && nearDuplicate(k.text, c.text));
    const prev = kept[i];
    if (prev === undefined) {
      kept.push(c);
      continue;
    }
    const [win, lose] = outranks(prev, c) ? [prev, c] : [c, prev];
    kept[i] = { ...win, supports: [...new Set([...win.supports, ...lose.supports])] };
    notes.push(`merged duplicate: ${lose.id}`);
  }
  return { kept, notes };
}

const Verdicts = z.array(z.object({ id: z.string(), supported: z.boolean() }));

export async function verifyClaims(ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  const out = emptyOutcome();
  out.claims_mode = "replace";
  // Only confirmed sources support a claim: an unverified or rejected-profile (namesake) page never backs a FACT
  const known = new Set(confirmedSources(ctx).map((s) => s.id));
  const screened = screenClaims(ctx.claims, ctx.sources, ctx.subject);
  out.notes.push(...screened.notes);
  const first = screened.kept.flatMap((claim): Claim[] => {
    const supports = claim.supports.filter((id) => known.has(id));
    const unknown = claim.supports.length - supports.length;
    if (unknown > 0) out.notes.push(`dropped unknown support id (${String(unknown)}): ${claim.id}`);
    if (supports.length === 0) {
      out.notes.push(`dropped (no source): ${claim.id}`);
      return [];
    }
    const c = { ...claim, supports };
    if (c.kind !== "FACT") return [c];
    if (!quoteSupported(c, ctx.sources)) {
      out.notes.push(unknown > 0 ? `downgraded (no confirmed support): ${c.id}` : `downgraded (quote not in source): ${c.id}`);
      return [downgrade(c)];
    }
    if (c.question_id === CV_QUESTION_ID && !cvQuoteSupported(c, ctx.sources)) {
      out.notes.push(`downgraded (quote only in the CV): ${c.id}`);
      return [downgrade(c)];
    }
    if (hedged(c.text)) {
      out.notes.push(`downgraded (hedged wording): ${c.id}`);
      return [downgrade(c)];
    }
    return [c];
  });
  const merged = mergeDuplicates(first);
  out.notes.push(...merged.notes);
  const deduped = merged.kept;
  const residue = deduped.filter((c) => c.kind === "FACT");
  let final = deduped;
  if (residue.length > 0) {
    try {
      const byId = new Map(ctx.sources.map((s) => [s.id, s]));
      const r = await ports.llm({
        model: "verify",
        system: "You check whether a quote actually supports a claim. Answer supported=false when the quote does not state the claim, the claim adds anything the quote does not say, is about someone else, or is taken out of context. You may only reject, never add.",
        prompt: residue
          .map((c) => `id=${c.id}\nclaim: ${c.text}\nquote: ${c.quote ?? ""}\nsource: ${byId.get(c.supports[0] ?? "")?.url ?? ""}`)
          .join("\n\n"),
        schema: Verdicts,
      });
      out.calls += 1;
      out.cost_usd += r.cost_usd;
      const rejected = new Set(r.value.filter((v) => !v.supported).map((v) => v.id));
      final = deduped.map((c) => (rejected.has(c.id) ? downgrade(c) : c));
      for (const id of rejected) out.notes.push(`downgraded (second model): ${id}`);
    } catch (error) {
      out.notes.push(`verify model failed, deterministic result kept: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  out.claims = final;
  out.empty = final.length === 0;
  return out;
}
