/**
 * Verify seam: deterministic screens (noise, unknown ids, quote-in-excerpt, hedges, alias contradictions), then a second model that may only downgrade.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/verify.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/verify.test.ts
 *
 * Key responsibilities:
 * - Unknown support ids are dropped; a claim left with no support is dropped (never shown without a source)
 * - FACT keeps its kind only if the normalised quote is inside one cited excerpt (after unknown ids are dropped)
 * - FACT with hedged wording ("likely", "may", "pravděpodobně", ...) becomes INFERENCE, note "hedged wording"
 * - screenClaims (shared with synthesize): drops self-declared noise ("unrelated content", "misattributed") and
 *   contradiction claims naming two aliases of one organisation ("A | B", "A (formerly B)", "A, formerly B" in a source)
 * - Residue (FACTs that passed) goes to the verify model; "not supported" downgrades to INFERENCE
 *
 * Design constraints:
 * - Downgrade or drop only, never promote; an LLM failure keeps the deterministic result
 * - Returns the full claim list (claims_mode = replace)
 */
import { z } from "zod";
import type { Claim, Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { normalizeText, quoteInNormalized } from "@/domain/quote";
import { emptyOutcome } from "@/recipe/runner";
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

function downgrade(claim: Claim): Claim {
  return { ...claim, kind: "INFERENCE", confidence: Math.min(claim.confidence, 0.5) };
}

/** Claim texts the extractor itself flags as noise: such content is ignored, never shown. */
const NOISE = /unrelated content|misattributed|appears to be unrelated/i;
/** Hedges: speculation is never a FACT. "may" only in lower case, so the month "May 2019" stays a fact. */
const HEDGE = /(?<!\p{L})(?:likely|probably|possibly|might|appears to|seems|presumably|pravděpodobně|zřejmě|asi)(?!\p{L})/iu;
const HEDGE_MAY = /(?<!\p{L})may(?!\p{L})/u;

export function hedged(text: string): boolean {
  return HEDGE.test(text) || HEDGE_MAY.test(text);
}

const fold = (text: string): string => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** A capitalised word; inner dots allowed (Kiwi.com), a sentence-ending dot is not part of it. */
const NAME = String.raw`\p{Lu}[\p{L}\p{N}&'-]*(?:\.[\p{L}\p{N}]+)*`;
const SIDE = String.raw`${NAME}(?:[ \t]+${NAME}){0,2}`;
const PIPE = new RegExp(String.raw`(${SIDE})[ \t]*\|[ \t]*(${SIDE})`, "gu");
const FORMERLY = new RegExp(String.raw`(${SIDE})[ \t]*(?:\(|,)[ \t]*(?:formerly|dříve|now|nyní)[ \t]+(${SIDE})`, "gu");
/** Title separators that join a name with a platform, not two names of one organisation. */
const NOT_ALIAS = new Set(["linkedin", "facebook", "x", "twitter", "instagram", "github", "youtube", "tiktok", "bluesky", "medium", "threads"]);

/** Every suffix of the left side and every prefix of the right: "Head Vilgain | Aktin" also yields Vilgain ~ Aktin. */
function sidePairs(left: string, right: string): [string, string][] {
  const l = left.split(/[ \t]+/);
  const r = right.split(/[ \t]+/);
  const pairs: [string, string][] = [];
  for (let i = 0; i < l.length; i++) for (let j = 1; j <= r.length; j++) pairs.push([l.slice(i).join(" "), r.slice(0, j).join(" ")]);
  return pairs;
}

/** Alias pairs ("Vilgain", "Aktin") stated by any source excerpt; platform names and the subject's own name never count. */
export function aliasPairs(sources: readonly Pick<Source, "excerpt">[], subject = ""): [string, string][] {
  const own = new Set(fold(subject).split(/\s+/).filter(Boolean));
  const usable = (side: string): boolean => side.split(/\s+/).every((w) => !NOT_ALIAS.has(fold(w)) && !own.has(fold(w)));
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
function names(text: string, name: string): boolean {
  const escaped = fold(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(String.raw`(?<![\p{L}\p{N}])${escaped}(?![\p{L}\p{N}])`, "u").test(fold(text));
}

/**
 * Noise and false-contradiction screen, shared by verify and synthesize so dropped claims never reach the brief,
 * its interview questions or to_verify.
 */
export function screenClaims(claims: readonly Claim[], sources: readonly Source[], subject: string): { kept: Claim[]; notes: string[] } {
  const notes: string[] = [];
  const aliases = aliasPairs(sources, subject);
  const kept = claims.filter((c) => {
    if (NOISE.test(c.text)) {
      notes.push(`dropped (unrelated or misattributed content): ${c.id}`);
      return false;
    }
    const alias = c.question_id === "contradictions" ? aliases.find(([a, b]) => names(c.text, a) && names(c.text, b)) : undefined;
    if (alias !== undefined) {
      notes.push(`dropped contradiction (aliases of one organisation: ${alias[0]} | ${alias[1]}): ${c.id}`);
      return false;
    }
    return true;
  });
  return { kept, notes };
}

const Verdicts = z.array(z.object({ id: z.string(), supported: z.boolean() }));

export async function verifyClaims(ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  const out = emptyOutcome();
  out.claims_mode = "replace";
  const known = new Set(ctx.sources.map((s) => s.id));
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
    if (hedged(c.text)) {
      out.notes.push(`downgraded (hedged wording): ${c.id}`);
      return [downgrade(c)];
    }
    return [c];
  });
  const residue = first.filter((c) => c.kind === "FACT");
  let final = first;
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
      final = first.map((c) => (rejected.has(c.id) ? downgrade(c) : c));
      for (const id of rejected) out.notes.push(`downgraded (second model): ${id}`);
    } catch (error) {
      out.notes.push(`verify model failed, deterministic result kept: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  out.claims = final;
  out.empty = final.length === 0;
  return out;
}
