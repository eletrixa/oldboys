/**
 * Extract seam: one LLM call turns stored excerpts into claims per question, each FACT with a verbatim quote.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/extract.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/seams.test.ts
 *
 * Key responsibilities:
 * - Feed only identity-merged sources (fetched for, or SERP hits on, a merged profile); never rejected profiles,
 *   namesake SERP hits or unverified name-search hits. Rejected profiles compare by profile key, not raw URL
 * - Validate every returned claim with the Claim schema; drop invalid ones with a note
 * - A claim without a quote is capped at NO_QUOTE_MAX (0.6) confidence
 * - Prompt: FACT text states only its quote (numbers kept, no hedges); no meta-claims about snippets, no ratings,
 *   nothing about unrelated content; contradictions only for incompatible statements on the same measure, aliases excluded
 * - LLM failure returns an empty outcome with a note (never throws), so the run degrades instead of failing
 *
 * Design constraints:
 * - Quotes must be verbatim substrings; verify.ts enforces it afterwards, this seam only asks for it
 * - Total prompt capped at PROMPT_CHARS so one step stays one call
 */
import { z } from "zod";
import { Claim } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { emptyOutcome } from "@/recipe/runner";
import { confirmedSources } from "@/recipe/seams/resolve";
import type { StepContext, StepOutcome } from "@/recipe/sources/types";

const PROMPT_CHARS = 60_000;
export const NO_QUOTE_MAX = 0.6;

const Extracted = z.array(
  z.object({
    question_id: z.string(),
    text: z.string().min(1),
    kind: z.enum(["FACT", "INFERENCE"]),
    confidence: z.number().min(0).max(1),
    quote: z.string().nullable(),
    source_ids: z.array(z.string()),
  }),
);

export async function extractClaims(ctx: StepContext, ports: Ports): Promise<StepOutcome> {
  const out = emptyOutcome();
  // Only confirmed material reaches the model. A name + city SERP returns every namesake, so a SERP hit counts only
  // once the Workflow marked it "merged" (its profile key equals a merged candidate's); the rest is "also found".
  const sources = confirmedSources(ctx);
  if (sources.length === 0) {
    out.notes.push("no usable sources");
    return out;
  }
  let body = "";
  for (const s of sources) {
    const line = `[${s.id}] ${s.url}\n${s.excerpt}\n\n`;
    if (body.length + line.length > PROMPT_CHARS) break;
    body += line;
  }
  const accepted = ctx.candidates.find((c) => c.decision === "merge");
  const questionIds = new Set(ctx.questions.map((q) => q.id));
  let r: { value: z.infer<typeof Extracted>; cost_usd: number };
  try {
    r = await ports.llm({
      model: "primary",
      system:
        [
          "Extract claims that answer the questions, from the sources only. For a FACT, `quote` must be a verbatim substring of one listed source and `source_ids` must list that source. `source_ids` may only contain ids shown in [brackets] below, copied exactly.",
          "A FACT states only what its quote states: add nothing the quote does not say, keep its specific numbers (write '$150M+ Google Ads spend', not 'large budgets'), and attribute exactly as the quote does (what the person credited, not a paraphrase). No hedges in a FACT ('likely', 'probably', 'may'); put any speculation (e.g. which company an unnamed employer was) into a separate INFERENCE claim.",
          "Anything you conclude rather than read is an INFERENCE (quote may be null).",
          "Claims are about the subject, never about the sources: no claims that a snippet is truncated, unclear or ambiguous, and no ratings or judgements of the person (reputation, visibility, seniority level, quality).",
          "Ignore content you judge unrelated to the subject or misattributed: emit no claim about it at all.",
          "For the `contradictions` question: emit a claim only when two sources make incompatible statements about the same measure or fact (same metric, same period, same role). Different measures (marketplace spend vs media budget) or different granularity are not contradictions. 'over N', 'N+' and rounded or approximate figures that agree within the rounding (e.g. 'over 13 years' vs '15 years') are compatible, not contradictions: emit nothing. Names joined by '|', 'formerly', 'now', 'dříve', 'nyní' or appearing together in one title line are aliases of one organisation, not a contradiction.",
          "Never infer health, religion, politics, ethnicity or sexuality. No claims about questions that no source answers.",
        ].join("\n"),
      prompt: `Subject: ${ctx.subject}\nAnchor: ${ctx.anchor}\n\nQuestions:\n${ctx.questions.map((q) => `- ${q.id}: ${q.text}`).join("\n")}\n\nSources:\n${body}`,
      schema: Extracted,
    });
  } catch (error) {
    // Degrade, never fail the run: synthesize builds an evidence-only brief from sources and gaps
    out.notes.push(`extract model failed: ${error instanceof Error ? error.message : String(error)}`);
    return out;
  }
  out.calls += 1;
  out.cost_usd += r.cost_usd;
  for (const e of r.value) {
    if (!questionIds.has(e.question_id)) continue;
    const parsed = Claim.safeParse({
      id: ports.newId(),
      run_id: ctx.runId,
      question_id: e.question_id,
      candidate_id: accepted?.id ?? null,
      text: e.text,
      kind: e.kind,
      // A claim without a quote is our reading, not a citation: its confidence never exceeds NO_QUOTE_MAX
      confidence: e.quote === null || e.quote.trim() === "" ? Math.min(e.confidence, NO_QUOTE_MAX) : e.confidence,
      quote: e.quote,
      supports: e.source_ids,
      contradicts: [],
      rank: 1,
    });
    if (parsed.success) out.claims.push(parsed.data);
    else out.notes.push(`dropped invalid claim: ${e.text.slice(0, 60)}`);
  }
  out.empty = out.claims.length === 0;
  return out;
}
