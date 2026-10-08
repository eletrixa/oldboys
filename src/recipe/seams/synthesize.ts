/**
 * Synthesize seam: protected-category filter on output, coverage per question, one LLM call for summaries + interview questions.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/synthesize.ts
 * Deps:    zod, src/domain/art9
 * Tested:  src/recipe/__tests__/seams.test.ts
 *
 * Key responsibilities:
 * - Drop claims about GDPR Art. 9 categories before anything is summarised (count only, content never stored)
 * - Coverage: evidenced = ≥1 FACT, partial = INFERENCE only, none = no claim
 *
 * Design constraints:
 * - Never scores or ranks the person; summaries restate evidence per question
 * - Always returns a Brief: model failure or zero claims gives an evidence-only brief with `degraded` set,
 *   confirmed source links (`evidence`) and templated interview questions (open social profiles, unevidenced role must-haves)
 * - Gaps split: `not_searched` (no request made, prefix stripped) vs `searched_empty`; `source` is the step id
 * - Confirmed = identity "merged" only; SERP hits on namesakes stay in `also_found`
 */
import { z } from "zod";
import { containsArt9Topic } from "@/domain/art9";
import type { Brief, Candidate, Claim, Coverage, Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { emptyOutcome } from "@/recipe/runner";
import { profileKey } from "@/recipe/seams/resolve";
import type { StepContext, StepOutcome } from "@/recipe/sources/types";

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

const PLATFORM_LABEL: Record<string, string> = { linkedin: "LinkedIn", github: "GitHub", x: "X", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", bluesky: "Bluesky" };

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "Is the LinkedIn account josef-buryan yours?" for a profile the manager left open. */
export function profileQuestion(c: Pick<Candidate, "platform" | "handle" | "profile_urls">): string {
  const url = c.profile_urls[0] ?? "";
  const label = PLATFORM_LABEL[c.platform];
  if (label === undefined) return `Is the page on ${host(url)} about you?`;
  return `Is the ${label} account ${c.handle ?? host(url)} yours?`;
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

export function evidenceOf(ctx: StepContext): Brief["evidence"] {
  return ctx.sources.filter(notRejected(ctx)).filter(confirmed).slice(0, EVIDENCE_MAX).map(row);
}

/** Unverified name-search hits: surfaced for the reader, never fed to the model. */
export function alsoFoundOf(ctx: StepContext): Brief["also_found"] {
  return ctx.sources.filter(notRejected(ctx)).filter((s) => !confirmed(s)).slice(0, EVIDENCE_MAX).map(row);
}

const PROFILE_PLATFORMS = new Set(Object.keys(PLATFORM_LABEL));
const IDENTITY_MAX = 2;

/**
 * Degraded mode: at most two identity questions about open social profiles (never plain web pages a candidate
 * cannot speak to), then the role must-haves (mh-) still without evidence, in the second person. Base research
 * prompts are never turned into interview questions.
 */
function templatedQuestions(ctx: StepContext, byQ: ReadonlyMap<string, readonly Claim[]>): string[] {
  const open = ctx.candidates
    .filter((c) => c.decision === "possibly-same-as" && PROFILE_PLATFORMS.has(c.platform))
    .sort((a, b) => b.score - a.score)
    .slice(0, IDENTITY_MAX);
  const mustHaves = ctx.questions
    .filter((q) => q.id.startsWith("mh-") && coverageOf(byQ.get(q.id) ?? []) === "none")
    .map((q) => askCandidate(q.text))
    .filter((x): x is string => x !== null);
  return [...new Set([...open.map(profileQuestion), ...mustHaves])].slice(0, INTERVIEW_MAX);
}

export async function synthesizeBrief(ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  const out = emptyOutcome();
  const kept = await dropProtected(ctx.claims, ports, out);
  const removed = ctx.claims.length - kept.length;
  if (removed > 0) out.notes.push(`removed protected category: ${String(removed)}`);

  const byQ = new Map<string, Claim[]>(ctx.questions.map((q) => [q.id, []]));
  for (const c of kept) byQ.get(c.question_id)?.push(c);

  let summaries = new Map<string, { summary: string; interview_question: string | null }>();
  // No claims = nothing for a model to summarise: skip the call, ship an evidence-only brief
  let degraded: string | null = kept.length === 0 ? "no verified claims (AI extraction unavailable or found nothing)" : null;
  if (degraded === null) {
    try {
      const r = await ports.llm({
        model: "primary",
        system:
          "Write the hiring-manager brief. For each question give a 1-3 sentence summary restating only the evidence (FACT = sourced, INFERENCE = our reading). Never rate the person. Where coverage is partial or none, write one concrete interview question that would close the gap; otherwise null.",
        prompt: ctx.questions
          .map((q) => {
            const cs = byQ.get(q.id) ?? [];
            return `## ${q.id}: ${q.text}\ncoverage=${coverageOf(cs)}\n${cs.map((c) => `- [${c.kind} ${c.confidence.toFixed(2)}] ${c.text}`).join("\n") || "- (no claims)"}`;
          })
          .join("\n\n"),
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

  const brief: Brief = {
    run_id: ctx.runId,
    per_question: ctx.questions.map((q) => {
      const cs = byQ.get(q.id) ?? [];
      return { question_id: q.id, coverage: coverageOf(cs), claim_ids: cs.map((c) => c.id), summary: summaries.get(q.id)?.summary ?? fallbackSummary(cs) };
    }),
    interview_questions:
      degraded === null
        ? ctx.questions.map((q) => summaries.get(q.id)?.interview_question ?? null).filter((x): x is string => x !== null)
        : templatedQuestions(ctx, byQ),
    to_verify: kept.filter((c) => c.kind === "INFERENCE").slice(0, 8).map((c) => c.text),
    not_searched: ctx.gaps
      .filter((g) => g.reason.startsWith(NOT_SEARCHED))
      .map((g) => ({ source: g.question_id, reason: g.reason.slice(NOT_SEARCHED.length).trim() || "no reason recorded" })),
    searched_empty: ctx.gaps.filter((g) => !g.reason.startsWith(NOT_SEARCHED)).map((g) => ({ source: g.question_id, reason: g.reason })),
    removed_protected: removed,
    degraded,
    evidence: evidenceOf(ctx),
    also_found: alsoFoundOf(ctx),
  };
  out.brief = brief;
  out.empty = false;
  return out;
}
