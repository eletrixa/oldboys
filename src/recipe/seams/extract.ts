/**
 * Extract seam: one LLM call turns stored excerpts into claims per question, each FACT with a verbatim quote.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/extract.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/seams.test.ts
 *
 * Key responsibilities:
 * - Feed only SERP hits and identity-merged sources; never rejected profiles or unverified name-search hits
 * - Validate every returned claim with the Claim schema; drop invalid ones with a note
 * - LLM failure returns an empty outcome with a note (never throws), so the run degrades instead of failing
 *
 * Design constraints:
 * - Quotes must be verbatim substrings; verify.ts enforces it afterwards, this seam only asks for it
 * - Total prompt capped at PROMPT_CHARS so one step stays one call
 */
import { z } from "zod";
import { Claim } from "@/domain/claim";
import type { Ports } from "@/domain/ports";

const SERP_ACTOR = "apify/google-search-scraper";
import { emptyOutcome } from "@/recipe/runner";
import type { StepContext, StepOutcome } from "@/recipe/sources/types";

const PROMPT_CHARS = 60_000;

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
  const rejectedUrls = new Set(ctx.candidates.filter((c) => c.decision === "rejected").flatMap((c) => c.profile_urls));
  // Only confirmed material reaches the model: discovery SERP hits (anchored by name + city) and sources fetched
  // for a merged profile. Name-search hits stay identity "unverified" and are listed as "also found", never claimed.
  const sources = ctx.sources.filter((s) => !rejectedUrls.has(s.url) && (s.identity === "merged" || s.actor === SERP_ACTOR));
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
        "Extract claims that answer the questions, from the sources only. For a FACT, `quote` must be a verbatim substring of one listed source and `source_ids` must list that source. Anything you conclude rather than read is an INFERENCE (quote may be null). Never infer health, religion, politics, ethnicity or sexuality. No claims about questions that no source answers.",
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
      confidence: e.confidence,
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
