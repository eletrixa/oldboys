/**
 * Turns a finished verification call into STATEMENT / INFERENCE claims, or a stated gap.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/call-ingest.ts
 * Deps:    zod
 * Tested:  src/domain/__tests__/call-ingest.test.ts
 *
 * Key responsibilities:
 * - Render the transcript as the source excerpt and build the extraction prompt
 * - Run one `primary` LLM extraction and gate each answer on a verbatim quote in a callee (`user`) turn
 * - Cap confidence (a callee statement is never a public fact) and never emit kind FACT
 *
 * Design constraints:
 * - Pure: the only side effect is the injected `llm` port
 * - The model never decides kind: STATEMENT only when the quote is found deterministically
 * - Answers for question ids outside the brief, or touching an Art. 9 topic, are dropped silently
 */
import { z } from "zod";
import type { CallBrief, CallResult, TranscriptTurn } from "@/domain/call";
import { containsArt9Topic } from "@/domain/call-brief";
import { Claim } from "@/domain/claim";
import type { LlmCall } from "@/domain/ports";
import { normalizeText, quoteInNormalized } from "@/domain/quote";

export const STATEMENT_MAX_CONFIDENCE = 0.6;

export function transcriptToExcerpt(transcript: readonly TranscriptTurn[]): string {
  return transcript
    .map((t) => `[${String(Math.round(t.time_in_call_secs))}s] ${t.role}: ${t.message}`)
    .join("\n");
}

export const CallExtraction = z.object({
  identity_confirmed: z.boolean(),
  refused: z.boolean(),
  answers: z.array(
    z.object({
      question_id: z.string().min(1),
      text: z.string().min(1),
      quote: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
});
export type CallExtraction = z.infer<typeof CallExtraction>;

export function buildExtractionPrompt(
  brief: CallBrief,
  excerpt: string,
): { system: string; prompt: string } {
  const system = [
    "You are an evidence extractor for a phone-call transcript between an AI agent and a callee.",
    "Rules:",
    "- Answer only the listed question ids; never add questions.",
    "- `quote` MUST be copied verbatim from a `user:` line of the transcript, never from the agent.",
    "- Never infer health, politics, religion, ethnicity or sexuality.",
    "- If the callee declined to talk or hung up, set refused=true.",
    "- Set identity_confirmed=true only if the callee clearly confirmed the identity question.",
    "- Omit a question when the callee gave no usable answer.",
  ].join("\n");
  const questions = brief.questions
    .map((q, i) => `${String(i + 1)}. [${q.question_id}] ${q.text}`)
    .join("\n");
  const prompt = [
    `Identity question: ${brief.identity_question}`,
    "",
    "Questions:",
    questions,
    "",
    "Transcript:",
    excerpt,
  ].join("\n");
  return { system, prompt };
}

export async function callResultToClaims(input: {
  result: CallResult;
  brief: CallBrief;
  runId: string;
  callId: string;
  sourceId: string;
  llm: LlmCall;
}): Promise<{ claims: Claim[]; gapReason: string | null }> {
  const { result, brief, runId, callId, sourceId, llm } = input;
  const none = (gapReason: string): { claims: Claim[]; gapReason: string } => ({ claims: [], gapReason });
  if (result.outcome !== "done") {
    return none(`call not completed: ${result.failure_reason ?? result.outcome}`);
  }
  if (!result.transcript.some((t) => t.role === "user")) return none("callee said nothing");

  const excerpt = transcriptToExcerpt(result.transcript);
  // The agent's own lines restate the claims it asks about; only what the callee said can back a STATEMENT.
  const calleeExcerpt = transcriptToExcerpt(result.transcript.filter((t) => t.role === "user"));
  const { value: extraction } = await llm({
    model: "primary",
    ...buildExtractionPrompt(brief, excerpt),
    schema: CallExtraction,
  });
  if (extraction.refused) return none("callee declined");
  if (!(result.identity_confirmed ?? extraction.identity_confirmed)) {
    return none("callee could not confirm identity");
  }

  const known = new Set(brief.questions.map((q) => q.question_id));
  const normalizedCallee = normalizeText(calleeExcerpt);
  const claims = extraction.answers
    .filter((a) => known.has(a.question_id) && !containsArt9Topic(a.text))
    .map((a) => {
      const statement = quoteInNormalized(a.quote, normalizedCallee);
      return Claim.parse({
        id: `${callId}:${a.question_id}`,
        run_id: runId,
        question_id: a.question_id,
        candidate_id: null,
        text: a.text,
        kind: statement ? "STATEMENT" : "INFERENCE",
        confidence: Math.min(a.confidence, STATEMENT_MAX_CONFIDENCE),
        quote: statement ? a.quote : null,
        supports: statement ? [sourceId] : [],
        contradicts: [],
        rank: 0,
      });
    });
  return { claims, gapReason: claims.length > 0 ? null : "callee gave no usable answers" };
}
