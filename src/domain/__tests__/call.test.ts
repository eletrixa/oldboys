/**
 * Round-trip and status-machine tests for the Verification Call schemas.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/call.test.ts
 * Deps:    vitest, zod
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Call, CallBrief and CallResult parse their canonical examples unchanged
 * - Every legal transition is listed; every other (status, event) pair throws
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import {
  Call,
  CallBrief,
  CallResult,
  CallStatus,
  IllegalCallTransition,
  maskNumber,
  transitionCall,
  type CallEvent,
} from "@/domain/call";

const brief: CallBrief = {
  language: "en",
  identity_question: "Am I speaking with Jane Doe?",
  questions: [
    { question_id: "current-role", text: "What is your current role?", expected: "staff engineer at Acme" },
  ],
  script: "Hello, I am an automated AI assistant...",
};

const call: Call = {
  id: "call-1",
  run_id: "run-1",
  status: "drafted",
  provider: "mock",
  provider_conversation_id: null,
  to_number_masked: null,
  consent_ack: false,
  consent_note: null,
  operator: null,
  brief,
  result_r2_key: null,
  call_successful: null,
  identity_confirmed: null,
  duration_secs: null,
  cost_usd: 0,
  failure_reason: null,
  last_error: null,
  created_at: "2026-10-08T10:00:00.000Z",
  approved_at: null,
  finished_at: null,
};

const result: CallResult = {
  provider_conversation_id: "conv-1",
  outcome: "done",
  transcript: [
    { role: "agent", message: "Am I speaking with Jane Doe?", time_in_call_secs: 0 },
    { role: "user", message: "Yes, this is Jane.", time_in_call_secs: 3 },
  ],
  data_collection: {},
  call_successful: true,
  identity_confirmed: true,
  duration_secs: 42,
  cost_usd: 0.06,
  failure_reason: null,
};

describe("call schemas round-trip", () => {
  it.each([
    ["CallBrief", CallBrief, brief],
    ["Call", Call, call],
    ["CallResult", CallResult, result],
  ] as const)("%s parses its canonical example unchanged", (_name, schema, value) => {
    expect(schema.parse(value)).toEqual(value);
  });

  it("caps a brief at five questions", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      question_id: `q${String(i)}`,
      text: "?",
      expected: "",
    }));
    expect(CallBrief.safeParse({ ...brief, questions: six }).success).toBe(false);
  });
});

describe("transitionCall", () => {
  const legal: [CallStatus, CallEvent, CallStatus][] = [
    ["drafted", { type: "approve" }, "dialing"],
    ["drafted", { type: "skip" }, "skipped"],
    ["dialing", { type: "dial-failed" }, "failed"],
    ["dialing", { type: "answered" }, "in_call"],
    ["dialing", { type: "result", outcome: "no_answer" }, "no_answer"],
    ["in_call", { type: "result", outcome: "done" }, "done"],
    ["in_call", { type: "result", outcome: "refused" }, "refused"],
    ["dialing", { type: "timeout" }, "failed"],
    ["in_call", { type: "timeout" }, "failed"],
  ];

  it.each(legal)("%s + %o -> %s", (from, event, to) => {
    expect(transitionCall(from, event)).toBe(to);
  });

  it("throws on every pair that is not listed as legal", () => {
    const events: CallEvent[] = [
      { type: "approve" },
      { type: "skip" },
      { type: "dial-failed" },
      { type: "answered" },
      { type: "result", outcome: "done" },
      { type: "timeout" },
    ];
    const legalKeys = new Set(legal.map(([s, e]) => `${s}:${e.type}`));
    for (const status of CallStatus.options) {
      for (const event of events) {
        if (legalKeys.has(`${status}:${event.type}`)) continue;
        expect(() => transitionCall(status, event)).toThrow(IllegalCallTransition);
      }
    }
  });
});

describe("maskNumber", () => {
  it("keeps the prefix and the last three digits", () => {
    expect(maskNumber("+420777123456")).toBe("+420******456");
  });

  it("masks short inputs completely", () => {
    expect(maskNumber("12345")).toBe("+***");
  });
});
