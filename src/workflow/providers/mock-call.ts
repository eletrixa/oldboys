/**
 * Mock call provider: a PlaceCall that answers instantly from the brief, plus the Source.actor labels.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/providers/mock-call.ts
 * Deps:    src/domain/call, src/domain/ports
 * Tested:  src/workflow/__tests__/mock-call.test.ts
 *
 * Key responsibilities:
 * - Return a deterministic, synchronous CallResult so the full call flow runs without a phone
 * - Own the Source.actor labels both providers use (MOCK stays visibly labeled downstream)
 *
 * Design constraints:
 * - Never touches the network and never reads secrets
 * - Output depends only on the input (no clock, no randomness)
 */
import type { CallResult, TranscriptTurn } from "@/domain/call";
import type { PlaceCall } from "@/domain/ports";

// Both providers label their Source.actor from here.
export const MOCK_SOURCE_ACTOR = "mock/convai";
export const ELEVENLABS_SOURCE_ACTOR = "elevenlabs/convai";

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
    for (const q of brief.questions) {
      turn("agent", q.text);
      turn("user", q.expected.length > 0 ? `Yes, I can confirm: ${q.expected}` : "I don't know.");
    }
    const last = transcript[transcript.length - 1];
    const providerConversationId = `mock-${callId}`;
    const result: CallResult = {
      provider_conversation_id: providerConversationId,
      outcome: "done",
      transcript,
      data_collection: { identity_confirmed: true, mock: true },
      call_successful: true,
      identity_confirmed: true,
      duration_secs: (last?.time_in_call_secs ?? 0) + 5,
      cost_usd: 0,
      failure_reason: null,
    };
    return Promise.resolve({ provider_conversation_id: providerConversationId, result });
  };
}
