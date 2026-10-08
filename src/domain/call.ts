/**
 * Zod schemas for the Verification Call aggregate: CallBrief, Call, CallResult, and its status machine.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/call.ts
 * Deps:    zod
 * Tested:  src/domain/__tests__/call.test.ts
 *
 * Key responsibilities:
 * - Single source of truth for the call shapes (plans/004-call-verification); routes, Workflow and
 *   providers import from here
 * - `transitionCall` is the only place that knows which status changes are legal
 *
 * Design constraints:
 * - Field names are snake_case and mirror migrations/0002_calls.sql one to one; booleans are
 *   INTEGER 0/1 in SQL and `boolean` here (the only type mapping, done at the D1 boundary)
 * - A call is dialed once, in a request handler, after `consent_ack` is true (never in a Workflow step)
 * - Pure: no I/O, no Workers types; must run under plain Node in Vitest
 */
import { z } from "zod";

export const CallStatus = z.enum([
  "drafted",
  "dialing",
  "in_call",
  "done",
  "failed",
  "no_answer",
  "refused",
  "skipped",
]);
export type CallStatus = z.infer<typeof CallStatus>;

export const CallProvider = z.enum(["elevenlabs", "mock"]);
export type CallProvider = z.infer<typeof CallProvider>;

/** One question the agent asks; `expected` is what a confirming answer would contain. */
export const CallQuestion = z.object({
  question_id: z.string().min(1),
  text: z.string().min(1),
  expected: z.string(),
});
export type CallQuestion = z.infer<typeof CallQuestion>;

/** Deterministic script handed to the voice agent; built by call-brief.ts, never by an LLM. */
export const CallBrief = z.object({
  language: z.string().min(2).max(5),
  identity_question: z.string().min(1),
  questions: z.array(CallQuestion).max(5),
  /** Full agent script: AI disclosure, consent line, identity question, questions, closing. */
  script: z.string().min(1),
});
export type CallBrief = z.infer<typeof CallBrief>;

export const Call = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  status: CallStatus,
  provider: CallProvider,
  provider_conversation_id: z.string().min(1).nullable(),
  /** Masked E.164, e.g. "+420*****123". The full number never persists. */
  to_number_masked: z.string().nullable(),
  consent_ack: z.boolean(),
  consent_note: z.string().nullable(),
  operator: z.string().nullable(),
  brief: CallBrief,
  result_r2_key: z.string().nullable(),
  call_successful: z.boolean().nullable(),
  identity_confirmed: z.boolean().nullable(),
  duration_secs: z.number().int().nonnegative().nullable(),
  cost_usd: z.number().nonnegative(),
  failure_reason: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string().min(1),
  approved_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});
export type Call = z.infer<typeof Call>;

export const TranscriptTurn = z.object({
  role: z.enum(["agent", "user"]),
  message: z.string(),
  time_in_call_secs: z.number().nonnegative(),
});
export type TranscriptTurn = z.infer<typeof TranscriptTurn>;

/** Outcome of a finished call as the provider reports it (ElevenLabs webhook / GET, or mock). */
export const CallOutcome = z.enum(["done", "failed", "no_answer", "refused"]);
export type CallOutcome = z.infer<typeof CallOutcome>;

export const CallResult = z.object({
  provider_conversation_id: z.string().min(1),
  outcome: CallOutcome,
  transcript: z.array(TranscriptTurn),
  /** Provider-side structured extraction (ElevenLabs data_collection_results), raw. */
  data_collection: z.record(z.string(), z.unknown()),
  call_successful: z.boolean().nullable(),
  /** Provider-side identity answer when available; null means "ask the extractor". */
  identity_confirmed: z.boolean().nullable(),
  duration_secs: z.number().int().nonnegative(),
  cost_usd: z.number().nonnegative(),
  failure_reason: z.string().nullable(),
});
export type CallResult = z.infer<typeof CallResult>;

export type CallEvent =
  | { type: "approve" }
  | { type: "skip" }
  | { type: "dial-failed" }
  | { type: "answered" }
  | { type: "result"; outcome: CallOutcome }
  | { type: "timeout" };

export class IllegalCallTransition extends Error {
  constructor(status: CallStatus, event: CallEvent["type"]) {
    super(`call in status "${status}" cannot take event "${event}"`);
    this.name = "IllegalCallTransition";
  }
}

/** Pure status machine; throws IllegalCallTransition on anything not listed. */
export function transitionCall(status: CallStatus, event: CallEvent): CallStatus {
  switch (event.type) {
    case "approve":
      if (status === "drafted") return "dialing";
      break;
    case "skip":
      if (status === "drafted") return "skipped";
      break;
    case "dial-failed":
      if (status === "dialing") return "failed";
      break;
    case "answered":
      if (status === "dialing") return "in_call";
      break;
    case "result":
      if (status === "dialing" || status === "in_call") return event.outcome;
      break;
    case "timeout":
      if (status === "dialing" || status === "in_call") return "failed";
      break;
  }
  throw new IllegalCallTransition(status, event.type);
}

/** Mask an E.164 number for storage: keep the country prefix and the last three digits. */
export function maskNumber(e164: string): string {
  const digits = e164.replace(/[^\d]/g, "");
  if (digits.length <= 6) return "+***";
  return `+${digits.slice(0, 3)}${"*".repeat(digits.length - 6)}${digits.slice(-3)}`;
}
