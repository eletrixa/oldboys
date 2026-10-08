/**
 * Tests for the LlmCall adapter using a faked generateText (no network).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/llm.test.ts
 * Deps:    vitest, zod
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Model selection, prompt pass-through, schema validation, cost arithmetic
 *
 * Design constraints:
 * - Never hits the network; generate is always injected
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createLlm, estimateCostUsd } from "../adapters/llm";

const schema = z.object({ answer: z.string() });
const models = { primary: "claude-opus-5-5", verify: "claude-sonnet-5-5" };

function setup(output: unknown) {
  const generate = vi.fn().mockResolvedValue({ output, usage: { inputTokens: 1000, outputTokens: 500 } });
  const api = createLlm({ apiKey: "k", models, generate: generate as never });
  return { generate, ...api };
}

function modelIdOf(generate: ReturnType<typeof vi.fn>): unknown {
  const arg = generate.mock.calls[0]?.[0] as { model: { modelId: string } };
  return arg.model.modelId;
}

describe("createLlm", () => {
  it("picks the primary and verify model ids and passes system and prompt through", async () => {
    const a = setup({ answer: "x" });
    await a.llm({ model: "primary", system: "sys", prompt: "p", schema });
    expect(modelIdOf(a.generate)).toBe("claude-opus-5-5");
    expect(a.generate.mock.calls[0]?.[0]).toMatchObject({ system: "sys", prompt: "p" });

    const b = setup({ answer: "x" });
    await b.llm({ model: "verify", system: "s", prompt: "q", schema });
    expect(modelIdOf(b.generate)).toBe("claude-sonnet-5-5");
  });

  it("rejects output that violates the schema or is missing", async () => {
    await expect(setup({ answer: 1 }).llm({ model: "primary", system: "", prompt: "", schema })).rejects.toThrow();
    await expect(setup(undefined).llm({ model: "primary", system: "", prompt: "", schema })).rejects.toThrow(
      /no structured output/,
    );
  });

  it("llm returns only the value; llmWithCost adds cost, ms and model", async () => {
    const a = setup({ answer: "x" });
    expect(await a.llm({ model: "primary", system: "", prompt: "", schema })).toEqual({ answer: "x" });
    const r = await a.llmWithCost<{ answer: string }>({ model: "primary", system: "", prompt: "", schema });
    expect(r.value).toEqual({ answer: "x" });
    expect(r.cost_usd).toBeCloseTo(0.014, 10);
    expect(r.model).toBe("claude-opus-5-5");
    expect(r.ms).toBeGreaterThanOrEqual(0);
  });
});

describe("estimateCostUsd", () => {
  it("prices opus 5.5 at 0.014 for 1000 in and 500 out", () => {
    expect(estimateCostUsd("claude-opus-5-5", { inputTokens: 1000, outputTokens: 500 })).toBeCloseTo(0.014, 10);
  });
  it("returns 0 for unknown models and missing usage", () => {
    expect(estimateCostUsd("mystery", { inputTokens: 1000 })).toBe(0);
    expect(estimateCostUsd("claude-opus-5-5", {})).toBe(0);
  });
});
