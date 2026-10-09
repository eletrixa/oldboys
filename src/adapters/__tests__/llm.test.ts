/**
 * Tests for the LLM adapter: the price table and what a call whose output was cut still costs.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/adapters/__tests__/llm.test.ts
 * Deps:    vitest (fake global fetch answering like the Anthropic Messages API)
 * Tested:  itself
 *
 * Key responsibilities:
 * - costOf: tokens × list price per model, an unknown model priced like the dearest one
 * - makeLlmCall: a parsed answer returns its cost; an answer cut at max tokens throws NoObjectGeneratedError with
 *   `cost_usd` from the reported usage (failedCallCost reads it)
 *
 * Design constraints:
 * - No network, no API key
 */
import { NoObjectGeneratedError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { costOf, makeLlmCall } from "@/adapters/llm";
import { failedCallCost } from "@/domain/report-translation";

afterEach(() => {
  vi.unstubAllGlobals();
});

function anthropicAnswer(text: string, stop: "end_turn" | "max_tokens", usage: { input_tokens: number; output_tokens: number }): Response {
  return Response.json({
    id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5-5",
    content: [{ type: "text", text }], stop_reason: stop, stop_sequence: null, usage,
  });
}

const call = (text: string, stop: "end_turn" | "max_tokens", usage: { input_tokens: number; output_tokens: number }) => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(anthropicAnswer(text, stop, usage)));
  const llm = makeLlmCall("test-key", { primary: "claude-opus-5-5", verify: "claude-sonnet-5-5" });
  return llm({ model: "verify", system: "s", prompt: "p", schema: z.object({ ok: z.boolean() }) });
};

describe("costOf", () => {
  it("prices tokens per model and an unknown model like the dearest one", () => {
    expect(costOf("claude-sonnet-5-5", { inputTokens: 1_000_000, outputTokens: 100_000 })).toBeCloseTo(3, 10);
    expect(costOf("claude-opus-5-5", { inputTokens: 1000, outputTokens: undefined })).toBeCloseTo(0.004, 10);
    expect(costOf("some-new-model", { inputTokens: 0, outputTokens: 1_000_000 })).toBe(20);
  });
});

describe("makeLlmCall", () => {
  it("returns the parsed value and its cost", async () => {
    const result = await call('{"ok":true}', "end_turn", { input_tokens: 1000, output_tokens: 100 });
    expect(result.value).toEqual({ ok: true });
    expect(result.cost_usd).toBeCloseTo(0.003, 10);
  });

  it("throws NoObjectGeneratedError carrying the cost when the output was cut", async () => {
    const error: unknown = await call('{"ok":tr', "max_tokens", { input_tokens: 1000, output_tokens: 8000 }).catch((e: unknown) => e);
    expect(NoObjectGeneratedError.isInstance(error)).toBe(true);
    expect(failedCallCost(error)).toBeCloseTo(0.082, 10);
  });
});
