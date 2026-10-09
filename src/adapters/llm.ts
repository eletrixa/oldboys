/**
 * LLM adapter: structured generation through the Vercel AI SDK + Anthropic provider, with USD cost from usage.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/adapters/llm.ts
 * Deps:    ai, @ai-sdk/anthropic, zod
 * Tested:  src/adapters/__tests__/llm.test.ts (costOf, cut output); seams are tested with a fake LlmCall
 *
 * Key responsibilities:
 * - `model: "primary" | "verify"` -> model id from vars LLM_MODEL_PRIMARY / LLM_MODEL_VERIFY
 * - Cost = input/output tokens × list price per model (USD per 1M tokens, 2026-10), `costOf`
 * - A call whose output does not parse (NoObjectGeneratedError, e.g. cut at maxOutputTokens) rethrows with `cost_usd`
 *   from the usage the provider reported, so a caller can still record what it cost (failedCallCost)
 *
 * Design constraints:
 * - Thinking left at the model default; no `budget_tokens` (rejected by Opus 5.5 / Sonnet 5.5)
 * - Output validated by the caller's Zod schema; a validation failure throws so the seam can fall back
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, NoObjectGeneratedError, Output, type LanguageModelUsage } from "ai";
import type { LlmCall } from "@/domain/ports";

const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

/** USD of one call from its token usage; an unknown model id is priced like the dearest one. */
export function costOf(modelId: string, usage: Pick<LanguageModelUsage, "inputTokens" | "outputTokens">): number {
  const price = PRICE_PER_M[modelId] ?? { in: 4, out: 20 };
  return ((usage.inputTokens ?? 0) * price.in + (usage.outputTokens ?? 0) * price.out) / 1_000_000;
}

export function makeLlmCall(apiKey: string, models: { primary: string; verify: string }): LlmCall {
  const anthropic = createAnthropic({ apiKey });
  return async ({ model, system, prompt, schema, maxOutputTokens }) => {
    const id = model === "primary" ? models.primary : models.verify;
    try {
      const result = await generateText({
        model: anthropic(id),
        system,
        prompt,
        output: Output.object({ schema }),
        // 17 questions x ~100 sources overflowed 8000 and truncated the JSON (run 88538fed); small seams pass their own cap
        maxOutputTokens: maxOutputTokens ?? 32_000,
      });
      return { value: result.output, cost_usd: costOf(id, result.usage) };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.usage !== undefined) {
        throw Object.assign(error, { cost_usd: costOf(id, error.usage) });
      }
      throw error;
    }
  };
}
