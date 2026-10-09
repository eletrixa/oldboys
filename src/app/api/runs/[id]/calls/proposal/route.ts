/**
 * POST /api/runs/:id/calls/proposal: AI-drafted verification call questions; logic lives in handler.ts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/calls/proposal/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), ./handler, ../load, src/adapters/{llm,d1}, bindings DB + SOURCES, secrets ANTHROPIC_API_KEY + RUN_TOKEN, vars LLM_MODEL_* + CALL_BUDGET_USD
 * Tested:  src/app/api/runs/[id]/calls/proposal/__tests__/handler.test.ts (via handler.ts)
 *
 * Key responsibilities:
 * - Wire the Cloudflare bindings and the real ports (LLM adapter, ledger append, call input loader) into proposalRoute
 *
 * Design constraints:
 * - No runtime = "edge"; no logic here; without ANTHROPIC_API_KEY the LLM port is null (the handler answers the rule-based questions)
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { makeLedgerAppend } from "@/adapters/d1";
import { makeLlmCall } from "@/adapters/llm";
import { loadCallInputs } from "../load";
import { proposalRoute } from "./handler";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const key = env.ANTHROPIC_API_KEY as string | undefined;
  const llm =
    key === undefined || key === ""
      ? null
      : makeLlmCall(key, { primary: env.LLM_MODEL_PRIMARY, verify: env.LLM_MODEL_VERIFY });
  return proposalRoute(request, env, id, { loadInputs: loadCallInputs, llm, ledger: makeLedgerAppend(env.DB), now: () => Date.now() });
}
