/**
 * LLM adapter: structured generation through the Vercel AI SDK + Anthropic provider, with USD cost from usage.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/adapters/llm.ts
 * Deps:    ai, @ai-sdk/anthropic, zod
 * Tested:  n/a (seams are tested with a fake LlmCall)
 *
 * Key responsibilities:
 * - `model: "primary" | "verify"` -> model id from vars LLM_MODEL_PRIMARY / LLM_MODEL_VERIFY
 * - Cost = input/output tokens × list price per model (USD per 1M tokens, 2026-10)
 *
 * Design constraints:
 * - Thinking left at the model default; no `budget_tokens` (rejected by Opus 5.5 / Sonnet 5.5)
 * - Output validated by the caller's Zod schema; a validation failure throws so the seam can fall back
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import type { LlmCall } from "@/domain/ports";

const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

export function makeLlmCall(apiKey: string, models: { primary: string; verify: string }): LlmCall {
  const anthropic = createAnthropic({ apiKey });
  return async ({ model, system, prompt, schema }) => {
    const id = model === "primary" ? models.primary : models.verify;
    const result = await generateText({
      model: anthropic(id),
      system,
      prompt,
      output: Output.object({ schema }),
      maxOutputTokens: 8000,
    });
    const price = PRICE_PER_M[id] ?? { in: 4, out: 20 };
    const inTok = result.usage.inputTokens ?? 0;
    const outTok = result.usage.outputTokens ?? 0;
    const cost_usd = (inTok * price.in + outTok * price.out) / 1_000_000;
    return { value: result.output, cost_usd };
  };
}
