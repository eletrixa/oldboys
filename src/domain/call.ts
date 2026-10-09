/**
 * Zod schemas for the Verification Call aggregate: CallBrief, Call, CallResult, CallAnswer, and its status machine.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/call.ts
 * Deps:    zod
 * Tested:  src/domain/__tests__/call.test.ts
 *
 * Key responsibilities:
 * - Single source of truth for the call shapes (plans/005-call-verification); routes, Workflow and
 *   providers import from here
 * - CallAnswer: the per-question result shown in the report (stored in the `call:finish` ledger row, no column)
 * - `allowedFrom` / `targetStatus` are the only place that knows which status changes are legal;
 *   `transitionCall` is the in-memory form, `applyCallEvent` (src/workflow/calls.ts) the atomic SQL form
 * - `countsTowardCallLimit` / `COUNTED_CALL_SQL` are the only place that knows which calls use a RUN_CALL_MAX slot
 *
 * Design constraints:
 * - Field names are snake_case and mirror migrations/0004_calls.sql one to one; booleans are
 *   INTEGER 0/1 in SQL and `boolean` here (the only type mapping, done at the D1 boundary)
 * - A call is dialed once, in a request handler, after `consent_ack` is true (never in a Workflow step)
 * - Pure: no I/O, no Workers types; must run under plain Node in Vitest
 */
import { z } from "zod";

export const CallStatus = z.enum([
  "drafted",
  "dialing",
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
  /** Why this question is asked, shown to the operator before the call ("No public evidence: Go backend"). */
  why: z.string().optional(),
  /** What a useful answer contains (concrete example, own part, scale); for HR and the agent, never a score, never read aloud. */
  listen_for: z.string().optional(),
  /** The one follow-up the agent may ask when the answer is vague. */
  follow_up: z.string().optional(),
});
export type CallQuestion = z.infer<typeof CallQuestion>;

/**
 * Script handed to the voice agent, composed by call-brief.ts. Its structure, first message, agent prompt and safety
 * filters are deterministic; only the question texts may be drafted by an LLM (call-questions-llm.ts), and HR edits them.
 */
export const CallBrief = z.object({
  language: z.string().min(2).max(5),
  identity_question: z.string().min(1),
  questions: z.array(CallQuestion).max(5),
  /** Full agent script: AI disclosure, consent line, identity question, questions, closing. */
  script: z.string().min(1),
  /** What the agent says first: AI disclosure, purpose, recording, skip/stop, consent question. Optional for rows stored before it existed. */
  first_message: z.string().optional(),
  /** System prompt for the voice agent (role, steps, questions, rules). Optional for rows stored before it existed. */
  agent_prompt: z.string().optional(),
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
  call_successful: z.boolean().nullable(),
  /** Provider-side identity answer when available; null means "ask the extractor". */
  identity_confirmed: z.boolean().nullable(),
  duration_secs: z.number().int().nonnegative(),
  cost_usd: z.number().nonnegative(),
  failure_reason: z.string().nullable(),
});
export type CallResult = z.infer<typeof CallResult>;

export const CallAnswerStatus = z.enum(["answered", "unclear", "declined", "no_answer", "not_asked"]);
export type CallAnswerStatus = z.infer<typeof CallAnswerStatus>;

/**
 * What one brief question got on the call. Said by the callee, never public evidence: `answered` means a
 * verbatim quote was found in a callee turn (a STATEMENT claim), `unclear` an answer without such a quote.
 */
export const CallAnswer = z.object({
  question_id: z.string().min(1),
  question: z.string().min(1),
  why: z.string().optional(),
  status: CallAnswerStatus,
  summary: z.string().nullable(),
  quote: z.string().nullable(),
  /** Seconds into the call of the first callee turn that contains the quote; null without a quote. */
  at_secs: z.number().nonnegative().nullable(),
});
export type CallAnswer = z.infer<typeof CallAnswer>;

export type CallEvent =
  | { type: "approve" }
  | { type: "skip" }
  | { type: "result"; outcome: CallOutcome }
  | { type: "fail" };

/** Which statuses may take each event: the single table behind transitionCall and the SQL guards. */
const ALLOWED_FROM: Record<CallEvent["type"], readonly CallStatus[]> = {
  approve: ["drafted"],
  skip: ["drafted"],
  result: ["dialing"],
  fail: ["dialing"],
};

export function allowedFrom(event: CallEvent["type"]): readonly CallStatus[] {
  return ALLOWED_FROM[event];
}

export function targetStatus(event: CallEvent): CallStatus {
  switch (event.type) {
    case "approve":
      return "dialing";
    case "skip":
      return "skipped";
    case "result":
      return event.outcome;
    case "fail":
      return "failed";
  }
}

export class IllegalCallTransition extends Error {
  constructor(status: CallStatus, event: CallEvent["type"]) {
    super(`call in status "${status}" cannot take event "${event}"`);
    this.name = "IllegalCallTransition";
  }
}

/** Pure status machine; throws IllegalCallTransition on anything not in ALLOWED_FROM. */
export function transitionCall(status: CallStatus, event: CallEvent): CallStatus {
  if (!allowedFrom(event.type).includes(status)) throw new IllegalCallTransition(status, event.type);
  return targetStatus(event);
}

/**
 * Statuses that use a RUN_CALL_MAX slot: a call in progress or one that reached the person. A call that never
 * connected (provider rejected it, busy, no answer: `failed` or `no_answer`) and a drafted or skipped one do not.
 */
export const COUNTED_CALL_STATUSES = ["dialing", "done", "refused"] as const satisfies readonly CallStatus[];

export function countsTowardCallLimit(status: CallStatus): boolean {
  return (COUNTED_CALL_STATUSES as readonly CallStatus[]).includes(status);
}

/** The same rule as a SQL condition on `calls.status` (constant literals, no binds). */
export const COUNTED_CALL_SQL = `status IN (${COUNTED_CALL_STATUSES.map((s) => `'${s}'`).join(", ")})`;

/** Mask an E.164 number for storage: keep the country prefix and the last three digits (short inputs are fully masked so nothing leaks). */
export function maskNumber(e164: string): string {
  const digits = e164.replace(/[^\d]/g, "");
  if (digits.length <= 6) return "+***";
  return `+${digits.slice(0, 3)}${"*".repeat(digits.length - 6)}${digits.slice(-3)}`;
}
