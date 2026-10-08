/**
 * Synthesize seam: protected-category filter on output, coverage per question, one LLM call for summaries + interview questions.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/synthesize.ts
 * Deps:    zod, src/domain/art9, src/recipe/seams/sections, src/recipe/seams/verify
 * Tested:  src/recipe/__tests__/seams.test.ts
 *
 * Key responsibilities:
 * - Drop claims about GDPR Art. 9 categories before anything is summarised (count only, content never stored)
 * - Coverage: evidenced = ≥1 FACT, partial = INFERENCE only, none = no claim
 * - Re-applies verify's screenClaims (noise, alias contradictions), so dropped claims never reach summaries,
 *   interview questions or to_verify
 * - Model interview questions: at most 5, only for questions interviewAllowed admits (unevidenced must-haves,
 *   surviving contradictions; `public-code` only for a technical role)
 * - also_found (hiring): a hit must name the subject's surname in excerpt or URL, otherwise it is noise and dropped
 *
 * Design constraints:
 * - Never scores or ranks the person; summaries restate evidence per question
 * - Always returns a Brief: model failure or zero claims gives an evidence-only brief with `degraded` set,
 *   confirmed source links (`evidence`) and templated interview questions (open social profiles, unevidenced role must-haves)
 * - Gaps split: `not_searched` (no request made, prefix stripped) vs `searched_empty`; `source` is the step id
 * - Confirmed = identity "merged" only; SERP hits on namesakes stay in `also_found`; both deduped by excerpt text
 * - `headline`: the title line of the best merged profile (LinkedIn first), quoted, so a keyless brief still says who this is
 * - Identity questions name the profile by its title line, never by URL slug; profiles without a handle are not asked;
 *   at most one per platform, none for a platform that already has a merged profile
 * - Evidence dedupe ignores trailing "...", "…", "Read more", "See more", "Více" and keeps the longer excerpt
 * - `location_note`: a merged profile names a known Czech city/region and never the anchor (stated, nothing deleted)
 * - Facebook: a Facebook candidate adds a static not_searched line (no collector; public pages need a login)
 * - `sections`: findings cut by what was found, confidence computed deterministically (seams/sections.ts), never by the model
 */
import { z } from "zod";
import { containsArt9Topic } from "@/domain/art9";
import type { Brief, Candidate, Claim, Coverage, Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { emptyOutcome } from "@/recipe/runner";
import { PLATFORM_RANK, profileKey } from "@/recipe/seams/resolve";
import { sectionsOf } from "@/recipe/seams/sections";
import { screenClaims } from "@/recipe/seams/verify";
import { platformOf, type StepContext, type StepOutcome } from "@/recipe/sources/types";

const Protected = z.array(z.object({ id: z.string(), protected: z.boolean() }));
const Summaries = z.array(z.object({ question_id: z.string(), summary: z.string(), interview_question: z.string().nullable() }));

export function coverageOf(claims: readonly Claim[]): Coverage {
  if (claims.some((c) => c.kind === "FACT")) return "evidenced";
  return claims.length > 0 ? "partial" : "none";
}

async function dropProtected(claims: readonly Claim[], ports: Ports, out: StepOutcome): Promise<Claim[]> {
  if (claims.length === 0) return [];
  let flagged = new Set(claims.filter((c) => containsArt9Topic(c.text) || containsArt9Topic(c.quote ?? "")).map((c) => c.id));
  try {
    const r = await ports.llm({
      model: "verify",
      system: "Flag claims that reveal or infer health, religion, politics, ethnicity, sexual orientation, trade-union membership or family planning (GDPR Art. 9). protected=true for those only.",
      prompt: claims.map((c) => `id=${c.id}: ${c.text}`).join("\n"),
      schema: Protected,
    });
    out.calls += 1;
    out.cost_usd += r.cost_usd;
    flagged = new Set([...flagged, ...r.value.filter((v) => v.protected).map((v) => v.id)]);
  } catch (error) {
    out.notes.push(`protected-category model failed, regex only: ${error instanceof Error ? error.message : String(error)}`);
  }
  return claims.filter((c) => !flagged.has(c.id));
}

const EVIDENCE_MAX = 40;
const INTERVIEW_MAX = 6;
const NOT_SEARCHED = "not searched:";

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 120);
}

/** Merged identity only (set by collectors or by the Workflow after the lineup); rejected profiles never count. */
function confirmed(s: Source): boolean {
  return s.identity === "merged";
}

function notRejected(ctx: StepContext): (s: Source) => boolean {
  const rejected = new Set(ctx.candidates.filter((c) => c.decision === "rejected").flatMap((c) => c.profile_urls.map(profileKey)));
  return (s) => !rejected.has(profileKey(s.url));
}

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  bluesky: "Bluesky",
  facebook: "Facebook",
};
const TITLE_MAX = 90;
const HEADLINE_MAX = 160;

function cut(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "Is the LinkedIn profile 'Josef Buryan - CMO, Groupon' yours?" for a profile the manager left open; slug only when there is no title. */
export function profileQuestion(c: Pick<Candidate, "platform" | "handle" | "profile_urls" | "snippet">): string {
  const url = c.profile_urls[0] ?? "";
  const label = PLATFORM_LABEL[c.platform];
  if (label === undefined) return `Is the page on ${host(url)} about you?`;
  const title = c.snippet.trim();
  return title !== "" ? `Is the ${label} profile '${cut(title, TITLE_MAX)}' yours?` : `Is the ${label} account ${c.handle ?? host(url)} yours?`;
}

/**
 * A research question rephrased for the candidate, or null when it is about our sources (anchor, contradictions).
 * ponytail: word swaps, not grammar; good for "the subject's / their / Has ..." phrasing the recipes and role seam use.
 */
export function askCandidate(text: string): string | null {
  if (/\b(anchor|sources?)\b/i.test(text)) return null;
  let q = text.replace(/\s*\([^)]*\)\s*$/, "").trim();
  q = q.replace(/\bthe subject's stated location\b/gi, "your location").replace(/\bthe subject's\b/gi, "your").replace(/\btheir\b/gi, "your").replace(/\bthey\b/gi, "you");
  q = q.replace(/^Has held\b/, "Have you held").replace(/^Has\b/, "Do you have").replace(/^Is (?!your\b)/, "Are you ");
  q = q.replace(/^Location compatible with\b:?\s*/i, "Is your location compatible with ");
  if (q.length === 0) return null;
  return q.endsWith("?") ? q : `${q}?`;
}

function row(s: Source): Brief["evidence"][number] {
  return { step: s.actor, url: s.url, excerpt: s.excerpt.slice(0, 300) };
}

/** Excerpt as a dedupe key: case, whitespace and trailing "...", "…", "Read more", "See more", "Více" ignored. */
export function excerptKey(excerpt: string): string {
  return excerpt.toLowerCase().replace(/(?:\s|\.{3}|…|read more|see more|více)+$/u, "").replace(/\s+/g, " ").trim();
}

/** One row per excerpt key, the longer excerpt wins: the same snippet from two hosts or cut two ways reads as one fact. */
function uniqueRows(sources: readonly Source[]): Brief["evidence"] {
  const byKey = new Map<string, Brief["evidence"][number]>();
  for (const r of sources.map(row)) {
    const k = excerptKey(r.excerpt);
    const prev = byKey.get(k);
    if (prev === undefined || r.excerpt.length > prev.excerpt.length) byKey.set(k, r);
  }
  return [...byKey.values()].slice(0, EVIDENCE_MAX);
}

/** Merged-identity sources whose profile the manager did not reject: the only ones a brief may present as found. */
function confirmedSources(ctx: StepContext): Source[] {
  return ctx.sources.filter(notRejected(ctx)).filter(confirmed);
}

export function evidenceOf(ctx: StepContext): Brief["evidence"] {
  return uniqueRows(confirmedSources(ctx));
}

/**
 * Unverified name-search hits: surfaced for the reader, never fed to the model. For a person (hiring), a hit that
 * names the surname nowhere in excerpt or URL (login pages, app stores, celebrities) is noise, not a namesake: dropped.
 */
export function alsoFoundOf(ctx: StepContext): Brief["also_found"] {
  const surname = fold(ctx.subject.trim().split(/\s+/).at(-1) ?? "");
  const namesSurname = (s: Source): boolean => ctx.goal !== "hiring" || surname === "" || fold(`${s.excerpt} ${s.url}`).includes(surname);
  return uniqueRows(ctx.sources.filter(notRejected(ctx)).filter((s) => !confirmed(s) && namesSurname(s)));
}

/** Title line of the best merged profile (platform rank: LinkedIn first), or null when nothing is confirmed. */
export function headlineOf(candidates: readonly Candidate[]): string | null {
  const rank = (p: string): number => (PLATFORM_RANK.includes(p) ? PLATFORM_RANK.indexOf(p) : PLATFORM_RANK.length);
  const best = candidates
    .filter((c) => c.decision === "merge" && c.snippet.trim() !== "")
    .sort((a, b) => rank(a.platform) - rank(b.platform) || b.score - a.score)[0];
  return best === undefined ? null : cut(best.snippet, HEADLINE_MAX);
}

/** 20 largest Czech cities plus their regions, as folded word prefixes (declension: Liberci, Brně, Praze). */
// ponytail: fixed list, prefix match; a small town anchor outside it only warns when a listed place appears
const PLACES: readonly (readonly string[])[] = [
  ["praha", "praze", "prahy", "prague"],
  ["brno", "brne", "brna", "jihomoravsk", "south moravia"],
  ["ostrav", "moravskoslezsk", "moravian-silesian"],
  ["plzen", "plzn", "pilsen"],
  ["liberec", "liberci", "liberc"],
  ["olomouc", "olomouck"],
  ["ceske budejovice", "ceskych budejovic", "jihocesk", "south bohemia"],
  ["hradec kralove", "hradci kralove", "kralovehradeck"],
  ["usti nad", "usteck"],
  ["pardubic"],
  ["zlin", "zlinsk"],
  ["havirov"],
  ["kladno", "kladne", "kladna", "stredocesk", "central bohemia"],
  ["opav"],
  ["frydek"],
  ["karvin"],
  ["jihlav", "vysocin"],
  ["teplic"],
  ["karlovy vary", "karlovych varech", "karlovarsk"],
  ["chomutov"],
];

const fold = (text: string): string => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Words (and word pairs) of the text, as written and folded, so a match can be quoted back. */
function phrases(text: string): { raw: string; folded: string }[] {
  const words = text.split(/[^\p{L}-]+/u).filter(Boolean);
  return words.flatMap((w, i) => {
    const pair = words[i + 1] === undefined ? [] : [`${w} ${words[i + 1] ?? ""}`];
    return [w, ...pair].map((raw) => ({ raw, folded: fold(raw) }));
  });
}

const placeOf = (folded: string): number => PLACES.findIndex((stems) => stems.some((st) => folded.startsWith(st)));

/**
 * "Confirmed profile mentions Jihomoravský, you entered Liberec": merged candidate titles and merged LinkedIn
 * excerpts never name the anchor but name another listed place. Null for URL or IČO anchors.
 */
export function locationNoteOf(anchor: string, candidates: readonly Candidate[], sources: readonly Source[]): string | null {
  const a = anchor.trim();
  if (a === "" || /[.@/]/.test(a) || /^\d+$/.test(a)) return null;
  const texts = [
    ...candidates.filter((c) => c.decision === "merge").map((c) => c.snippet),
    ...sources.filter((s) => confirmed(s) && platformOf(s.url) === "linkedin").map((s) => s.excerpt),
  ];
  const found = phrases(texts.join("\n"));
  const anchorPlace = placeOf(fold(a));
  const isAnchor = (f: string): boolean => (anchorPlace >= 0 ? placeOf(f) === anchorPlace : f === fold(a));
  if (found.some((p) => isAnchor(p.folded)) || (anchorPlace < 0 && fold(texts.join(" ")).includes(fold(a)))) return null;
  const other = found.find((p) => placeOf(p.folded) >= 0);
  return other === undefined ? null : `Confirmed profile mentions ${other.raw}, you entered ${a}`;
}

const PROFILE_PLATFORMS = new Set(Object.keys(PLATFORM_LABEL));
const IDENTITY_MAX = 2;
const FACEBOOK_GAP = { source: "facebook_profile", reason: "not collected: public Facebook pages need a login" };

/**
 * Degraded mode: at most two identity questions about open social profiles (never plain web pages a candidate
 * cannot speak to; one per platform, none where a profile is already merged), then the role must-haves (mh-) still without evidence, in the second person. Base research
 * prompts are never turned into interview questions.
 */
function templatedQuestions(ctx: StepContext, byQ: ReadonlyMap<string, readonly Claim[]>): string[] {
  const done = new Set(ctx.candidates.filter((c) => c.decision === "merge").map((c) => c.platform));
  const open: Candidate[] = [];
  const byScore = ctx.candidates.filter((c) => c.decision === "possibly-same-as" && PROFILE_PLATFORMS.has(c.platform) && c.handle !== null).sort((a, b) => b.score - a.score);
  for (const c of byScore) {
    if (open.length >= IDENTITY_MAX || done.has(c.platform)) continue;
    done.add(c.platform);
    open.push(c);
  }
  const mustHaves = ctx.questions
    .filter((q) => q.id.startsWith("mh-") && coverageOf(byQ.get(q.id) ?? []) === "none")
    .map((q) => askCandidate(q.text))
    .filter((x): x is string => x !== null);
  return [...new Set([...open.map(profileQuestion), ...mustHaves])].slice(0, INTERVIEW_MAX);
}

const MODEL_INTERVIEW_MAX = 5;
/** Roles whose work is code or data: only these get the base `public-code` question turned into an interview question. */
const TECH_ROLE = /\b(?:engineer\w*|develop\w*|devops|data|software|technical|programm\w*|architect\w*|scientist|sre|backend|frontend|full[- ]?stack|coder)\b/i;

/**
 * Which questions may carry a model-written interview question: `contradictions` only when a real contradiction
 * claim survived; with role must-haves (mh-), only those with coverage partial or none; without them, any
 * question not evidenced, `public-code` only for a technical role.
 */
export function interviewAllowed(ctx: Pick<StepContext, "questions" | "role">, byQ: ReadonlyMap<string, readonly Claim[]>): (questionId: string) => boolean {
  const hasMustHaves = ctx.questions.some((q) => q.id.startsWith("mh-"));
  return (id) => {
    const cs = byQ.get(id) ?? [];
    if (id === "contradictions") return cs.length > 0;
    if (coverageOf(cs) === "evidenced") return false;
    if (hasMustHaves) return id.startsWith("mh-");
    return id !== "public-code" || TECH_ROLE.test(ctx.role ?? "");
  };
}

export async function synthesizeBrief(ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  const out = emptyOutcome();
  const unprotected = await dropProtected(ctx.claims, ports, out);
  const removed = ctx.claims.length - unprotected.length;
  if (removed > 0) out.notes.push(`removed protected category: ${String(removed)}`);
  // Same noise / alias screen as verify: a dropped false contradiction never reaches summaries, questions or to_verify
  const screened = screenClaims(unprotected, ctx.sources, ctx.subject);
  out.notes.push(...screened.notes);
  const kept = screened.kept;

  const byQ = new Map<string, Claim[]>(ctx.questions.map((q) => [q.id, []]));
  for (const c of kept) byQ.get(c.question_id)?.push(c);
  const askable = interviewAllowed(ctx, byQ);

  let summaries = new Map<string, { summary: string; interview_question: string | null }>();
  // No claims = nothing for a model to summarise: skip the call, ship an evidence-only brief
  let degraded: string | null = kept.length === 0 ? "no verified claims" : null;
  if (degraded === null) {
    try {
      const r = await ports.llm({
        model: "primary",
        system:
          [
            "Write the hiring-manager brief. For each question give a 1-3 sentence summary restating only the evidence (FACT = sourced, INFERENCE = our reading). Never rate the person.",
            "Interview questions: only where `interview_question_allowed=yes`, write one concrete question for the role that would close the gap; otherwise null. Never ask the candidate to explain something the evidence already resolves, and never ask about tasks the role does not need.",
            "Contradictions: only incompatible statements about the same measure or fact (same metric, same period, same role) count. Different measures or granularity are not contradictions; names joined by '|', 'formerly', 'now', 'dříve', 'nyní' or in one title line are aliases of one organisation.",
          ].join("\n"),
        prompt: `Role: ${ctx.role ?? "(none)"}\n\n${ctx.questions
          .map((q) => {
            const cs = byQ.get(q.id) ?? [];
            return `## ${q.id}: ${q.text}\ncoverage=${coverageOf(cs)} interview_question_allowed=${askable(q.id) ? "yes" : "no"}\n${cs.map((c) => `- [${c.kind} ${c.confidence.toFixed(2)}] ${c.text}`).join("\n") || "- (no claims)"}`;
          })
          .join("\n\n")}`,
        schema: Summaries,
      });
      out.calls += 1;
      out.cost_usd += r.cost_usd;
      summaries = new Map(r.value.map((s) => [s.question_id, { summary: s.summary, interview_question: s.interview_question }]));
    } catch (error) {
      degraded = `summary model failed: ${message(error)}`;
      out.notes.push(degraded);
    }
  }

  const fallbackSummary = (cs: readonly Claim[]): string =>
    [`AI summary unavailable: ${degraded ?? "no summary returned"}.`, ...cs.map((c) => c.text)].join(" ");

  const perQuestion: Brief["per_question"] = ctx.questions.map((q) => {
    const cs = byQ.get(q.id) ?? [];
    return { question_id: q.id, coverage: coverageOf(cs), claim_ids: cs.map((c) => c.id), summary: summaries.get(q.id)?.summary ?? fallbackSummary(cs) };
  });
  const brief: Brief = {
    run_id: ctx.runId,
    per_question: perQuestion,
    interview_questions:
      degraded === null
        ? ctx.questions
            .filter((q) => askable(q.id))
            .map((q) => summaries.get(q.id)?.interview_question ?? null)
            .filter((x): x is string => x !== null && x.trim() !== "")
            .slice(0, MODEL_INTERVIEW_MAX)
        : templatedQuestions(ctx, byQ),
    to_verify: kept.filter((c) => c.kind === "INFERENCE").slice(0, 8).map((c) => c.text),
    not_searched: ctx.gaps
      .filter((g) => g.reason.startsWith(NOT_SEARCHED))
      .map((g) => ({ source: g.question_id, reason: g.reason.slice(NOT_SEARCHED.length).trim() || "no reason recorded" }))
      .concat(ctx.candidates.some((c) => c.platform === "facebook") ? [FACEBOOK_GAP] : []),
    searched_empty: ctx.gaps.filter((g) => !g.reason.startsWith(NOT_SEARCHED)).map((g) => ({ source: g.question_id, reason: g.reason })),
    removed_protected: removed,
    degraded,
    evidence: evidenceOf(ctx),
    also_found: alsoFoundOf(ctx),
    headline: headlineOf(ctx.candidates),
    location_note: locationNoteOf(ctx.anchor, ctx.candidates, ctx.sources),
    sections: sectionsOf(ctx.questions, kept, perQuestion, ctx.sources, confirmedSources(ctx)),
  };
  out.brief = brief;
  out.empty = false;
  return out;
}
