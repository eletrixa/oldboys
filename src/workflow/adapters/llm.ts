/**
 * LlmCall adapter: Vercel AI SDK + Anthropic, structured output validated by the caller's Zod schema.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/adapters/llm.ts
 * Deps:    ai, @ai-sdk/anthropic
 * Tested:  src/workflow/__tests__/llm.test.ts
 *
 * Key responsibilities:
 * - Map the "primary" | "verify" seam to a model id and run generateText with Output.object
 * - Return the schema-parsed value; llmWithCost also returns cost_usd, ms and model for the ledger
 *
 * Design constraints:
 * - Budget is enforced by the runner, not here; this only reports cost
 * - Unknown model ids price at 0 rather than throwing
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import type { z } from "zod";
import type { LlmCall } from "../../domain/ports";

export type LlmModels = { primary: string; verify: string };

export const MODEL_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateCostUsd(
  modelId: string,
  usage: { inputTokens?: number; outputTokens?: number },
): number {
  const price = MODEL_PRICES_USD_PER_MTOK[modelId];
  if (price === undefined) return 0;
  return ((usage.inputTokens ?? 0) * price.input + (usage.outputTokens ?? 0) * price.output) / 1e6;
}

export type LlmCallWithCost = <T>(
  input: Omit<Parameters<LlmCall>[0], "schema"> & { schema: z.ZodType<T> },
) => Promise<{ value: T; cost_usd: number; ms: number; model: string }>;

export function createLlm(input: {
  apiKey: string;
  models: LlmModels;
  generate?: typeof generateText;
}): { llm: LlmCall; llmWithCost: LlmCallWithCost } {
  const provider = createAnthropic({ apiKey: input.apiKey });
  const generate = input.generate ?? generateText;

  const llmWithCost: LlmCallWithCost = async (call) => {
    const model = input.models[call.model];
    const started = Date.now();
    const result = await generate({
      model: provider(model),
      system: call.system,
      prompt: call.prompt,
      output: Output.object({ schema: call.schema }),
    });
    const raw: unknown = result.output;
    if (raw === undefined || raw === null) throw new Error(`LLM ${model} returned no structured output`);
    return {
      value: call.schema.parse(raw),
      cost_usd: estimateCostUsd(model, result.usage),
      ms: Date.now() - started,
      model,
    };
  };

  const llm: LlmCall = async (call) => (await llmWithCost(call)).value;
  return { llm, llmWithCost };
}
