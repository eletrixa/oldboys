/**
 * Mock call provider: a PlaceCall that answers instantly from the brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/providers/mock-call.ts
 * Deps:    src/domain/call, src/domain/ports
 * Tested:  src/workflow/__tests__/mock-call.test.ts
 *
 * Key responsibilities:
 * - Return a deterministic, synchronous CallResult so the full call flow runs without a phone
 * - Questions without an expected answer get a canned reply by position (answer, decline, answer) so a
 *   MOCK demo shows the answered and declined states
 *
 * Design constraints:
 * - Never touches the network and never reads secrets
 * - Output depends only on the input (no clock, no randomness)
 */
import type { CallResult, TranscriptTurn } from "@/domain/call";
import type { PlaceCall } from "@/domain/ports";

/** Canned callee replies by question index, for questions without an expected answer. */
export const MOCK_REPLIES = [
  "Yes. I used it every day in my current job for about two years.",
  "I would rather not answer that one.",
  "Yes, I did that on a project last year.",
] as const;

function mockReply(expected: string, index: number): string {
  if (expected.length > 0) return `Yes, I can confirm: ${expected}`;
  return MOCK_REPLIES[Math.min(index, MOCK_REPLIES.length - 1)] ?? MOCK_REPLIES[2];
}

export function mockPlaceCall(): PlaceCall {
  return ({ callId, brief }) => {
    let time = 0;
    const transcript: TranscriptTurn[] = [];
    const turn = (role: TranscriptTurn["role"], message: string): void => {
      transcript.push({ role, message, time_in_call_secs: time });
      time += 2;
    };

    time = 0;
    turn("agent", brief.identity_question);
    turn("user", "Yes, that's me.");
    for (const [i, q] of brief.questions.entries()) {
      turn("agent", q.text);
      turn("user", mockReply(q.expected, i));
    }
    const last = transcript[transcript.length - 1];
    const providerConversationId = `mock-${callId}`;
    const result: CallResult = {
      provider_conversation_id: providerConversationId,
      outcome: "done",
      transcript,
      call_successful: true,
      identity_confirmed: true,
      duration_secs: (last?.time_in_call_secs ?? 0) + 5,
      cost_usd: 0,
      failure_reason: null,
    };
    return Promise.resolve({ provider_conversation_id: providerConversationId, result });
  };
}
