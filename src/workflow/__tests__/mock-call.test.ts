/**
 * Tests for the mock call provider.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/mock-call.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - The mock result is a valid CallResult that echoes every question and expected answer
 * - Questions without an expected text get the canned answer / decline / answer replies by position
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { CallResult, type CallBrief } from "@/domain/call";
import { MOCK_REPLIES, mockPlaceCall } from "@/workflow/providers/mock-call";

const brief: CallBrief = {
  language: "en",
  identity_question: "Am I speaking with Jane Doe?",
  questions: [
    { question_id: "role", text: "What is your current role?", expected: "staff engineer at Acme" },
    { question_id: "city", text: "Which city are you based in?", expected: "" },
  ],
  script: "Hello, I am an automated AI assistant...",
};

describe("mockPlaceCall", () => {
  it("returns a synchronous result that parses as CallResult", async () => {
    const placed = await mockPlaceCall()({ callId: "c1", toNumber: "+420123456789", brief });
    expect(placed.result).not.toBeNull();
    const parsed = CallResult.parse(placed.result);
    expect(parsed.outcome).toBe("done");
    expect(parsed.identity_confirmed).toBe(true);
    expect(parsed.call_successful).toBe(true);
    expect(parsed.cost_usd).toBe(0);
  });

  it("derives the conversation id from the call id", async () => {
    const placed = await mockPlaceCall()({ callId: "c1", toNumber: "+420123456789", brief });
    expect(placed.provider_conversation_id).toBe("mock-c1");
    expect(placed.result?.provider_conversation_id).toBe("mock-c1");
  });

  it("puts every question and expected text in the transcript", async () => {
    const placed = await mockPlaceCall()({ callId: "c1", toNumber: "+420123456789", brief });
    const text = placed.result?.transcript.map((t) => t.message).join("\n") ?? "";
    expect(text).toContain(brief.identity_question);
    for (const q of brief.questions) {
      expect(text).toContain(q.text);
      if (q.expected.length > 0) expect(text).toContain(q.expected);
    }
  });

  it("answers questions without an expected text by position: answer, decline, answer", async () => {
    const open = ["a", "b", "c", "d"].map((id) => ({ question_id: id, text: `Question ${id}?`, expected: "" }));
    const placed = await mockPlaceCall()({ callId: "c2", toNumber: "+420123456789", brief: { ...brief, questions: open } });
    const replies = placed.result?.transcript.filter((t) => t.role === "user").slice(1).map((t) => t.message);
    expect(replies).toEqual([...MOCK_REPLIES, MOCK_REPLIES[2]]);
  });

  it("declines the second question when it has no expected text", async () => {
    const placed = await mockPlaceCall()({ callId: "c1", toNumber: "+420123456789", brief });
    const text = placed.result?.transcript.map((t) => t.message).join("\n") ?? "";
    expect(text).toContain("I would rather not answer that one.");
  });

  it("is deterministic for the same input", async () => {
    const input = { callId: "c1", toNumber: "+420123456789", brief };
    const a = await mockPlaceCall()(input);
    const b = await mockPlaceCall()(input);
    expect(a).toEqual(b);
  });
});
