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
 *   confirmed source links (`evidence`), gaps as interview questions; "not searched:" gaps listed first
 */
import { z } from "zod";
import { containsArt9Topic } from "@/domain/art9";
import type { Brief, Claim, Coverage, Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { emptyOutcome } from "@/recipe/runner";
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

const SERP_ACTOR = "apify/google-search-scraper";
const EVIDENCE_MAX = 40;
const NOT_SEARCHED = "not searched:";

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 120);
}

/** Search hits plus sources under a merged profile URL; rejected profiles never count as evidence. */
function confirmed(ctx: StepContext, s: Source): boolean {
  return s.identity === "merged" || s.actor === SERP_ACTOR;
}

function row(s: Source): Brief["evidence"][number] {
  return { step: s.actor, url: s.url, excerpt: s.excerpt.slice(0, 300) };
}

export function evidenceOf(ctx: StepContext): Brief["evidence"] {
  const rejected = new Set(ctx.candidates.filter((c) => c.decision === "rejected").flatMap((c) => c.profile_urls));
  return ctx.sources.filter((s) => !rejected.has(s.url) && confirmed(ctx, s)).slice(0, EVIDENCE_MAX).map(row);
}

/** Unverified name-search hits: surfaced for the reader, never fed to the model. */
export function alsoFoundOf(ctx: StepContext): Brief["also_found"] {
  const rejected = new Set(ctx.candidates.filter((c) => c.decision === "rejected").flatMap((c) => c.profile_urls));
  return ctx.sources.filter((s) => !rejected.has(s.url) && !confirmed(ctx, s)).slice(0, EVIDENCE_MAX).map(row);
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
  const gaps = [...ctx.gaps].sort((a, b) => Number(b.reason.startsWith(NOT_SEARCHED)) - Number(a.reason.startsWith(NOT_SEARCHED)));

  const brief: Brief = {
    run_id: ctx.runId,
    per_question: ctx.questions.map((q) => {
      const cs = byQ.get(q.id) ?? [];
      return { question_id: q.id, coverage: coverageOf(cs), claim_ids: cs.map((c) => c.id), summary: summaries.get(q.id)?.summary ?? fallbackSummary(cs) };
    }),
    interview_questions: [
      ...ctx.questions
        .map((q) => summaries.get(q.id)?.interview_question ?? (coverageOf(byQ.get(q.id) ?? []) === "evidenced" ? null : `Ask about: ${q.text}`))
        .filter((x): x is string => x !== null),
      // Degraded: every searched-but-empty source becomes a direct question to the candidate
      ...(degraded === null ? [] : gaps.filter((g) => !g.reason.startsWith(NOT_SEARCHED)).map((g) => `Confirm with the candidate (${g.question_id}): ${g.reason}`)),
    ],
    to_verify: kept.filter((c) => c.kind === "INFERENCE").slice(0, 8).map((c) => c.text),
    not_searched: gaps.map((g) => ({ source: g.question_id, reason: g.reason })),
    removed_protected: removed,
    degraded,
    evidence: evidenceOf(ctx),
    also_found: alsoFoundOf(ctx),
  };
  out.brief = brief;
  out.empty = false;
  return out;
}
