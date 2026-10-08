/**
 * Turns a finished verification call into STATEMENT / INFERENCE claims, or a stated gap.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/call-ingest.ts
 * Deps:    zod, src/domain/art9
 * Tested:  src/domain/__tests__/call-ingest.test.ts
 *
 * Key responsibilities:
 * - Render the transcript as the source excerpt and build the extraction prompt
 * - Run one `primary` LLM extraction and gate each answer on a verbatim quote in a callee (`user`) turn
 * - Cap confidence (a callee statement is never a public fact) and never emit kind FACT
 * - callAnswers: one CallAnswer per brief question (answered / unclear / declined / no_answer / not_asked),
 *   with the time in the call of the callee turn that holds the quote
 *
 * Design constraints:
 * - Pure: the only side effect is the injected `llm` port
 * - The model never decides kind: STATEMENT only when the quote is found deterministically
 * - Answers for question ids outside the brief, or touching an Art. 9 topic, are dropped silently
 */
import { z } from "zod";
import type { CallAnswer, CallBrief, CallResult, TranscriptTurn } from "@/domain/call";
import { containsArt9Topic } from "@/domain/art9";
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
  /** Question ids the callee explicitly declined to answer; defaulted so older fakes and outputs still parse. */
  declined_question_ids: z.array(z.string()).default([]),
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
    "- List question ids the callee explicitly declined to answer in declined_question_ids.",
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

/** Seconds into the call of the first callee turn that contains the quote; null when none does. */
function quoteTime(quote: string, transcript: readonly TranscriptTurn[]): number | null {
  const turn = transcript.find((t) => t.role === "user" && quoteInNormalized(quote, normalizeText(t.message)));
  return turn ? turn.time_in_call_secs : null;
}

/**
 * One result per brief question, in brief order. `ended` (refused, identity not confirmed, not completed)
 * marks every question not asked; otherwise a STATEMENT is answered, an INFERENCE unclear.
 */
export function callAnswers(input: {
  brief: CallBrief;
  transcript: readonly TranscriptTurn[];
  claims: readonly Claim[];
  declined: readonly string[];
  ended: boolean;
}): CallAnswer[] {
  const byQuestion = new Map(input.claims.map((c) => [c.question_id, c]));
  const declined = new Set(input.declined);
  return input.brief.questions.map((q): CallAnswer => {
    const base = { question_id: q.question_id, question: q.text, ...(q.why === undefined ? {} : { why: q.why }) };
    const none = { summary: null, quote: null, at_secs: null };
    if (input.ended) return { ...base, status: "not_asked", ...none };
    const claim = byQuestion.get(q.question_id);
    if (claim?.kind === "STATEMENT" && claim.quote !== null) {
      return { ...base, status: "answered", summary: claim.text, quote: claim.quote, at_secs: quoteTime(claim.quote, input.transcript) };
    }
    if (claim) return { ...base, status: "unclear", ...none, summary: claim.text };
    return { ...base, status: declined.has(q.question_id) ? "declined" : "no_answer", ...none };
  });
}

export async function callResultToClaims(input: {
  result: CallResult;
  brief: CallBrief;
  runId: string;
  callId: string;
  sourceId: string;
  llm: LlmCall;
}): Promise<{ claims: Claim[]; gapReason: string | null; answers: CallAnswer[] }> {
  const { result, brief, runId, callId, sourceId, llm } = input;
  const none = (gapReason: string): { claims: Claim[]; gapReason: string; answers: CallAnswer[] } => ({
    claims: [],
    gapReason,
    answers: callAnswers({ brief, transcript: result.transcript, claims: [], declined: [], ended: true }),
  });
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
  const answers = callAnswers({
    brief,
    transcript: result.transcript,
    claims,
    declined: extraction.declined_question_ids,
    ended: false,
  });
  return { claims, gapReason: claims.length > 0 ? null : "callee gave no usable answers", answers };
}
