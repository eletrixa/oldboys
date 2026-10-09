/**
 * POST /api/runs/:id/personality: read the working style (incl. Big Five) again for a finished run; logic in handler.ts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/personality/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), ./handler, src/adapters/{llm,d1}, bindings DB, secrets ANTHROPIC_API_KEY + RUN_TOKEN, vars LLM_MODEL_*
 * Tested:  src/app/api/runs/[id]/personality/__tests__/handler.test.ts (via handler.ts)
 *
 * Key responsibilities:
 * - Wire the Cloudflare bindings and the real ports (LLM adapter, ledger append) into personalityRoute
 *
 * Design constraints:
 * - No runtime = "edge"; no logic here; without ANTHROPIC_API_KEY the LLM port is null (the handler answers 503)
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { makeLedgerAppend } from "@/adapters/d1";
import { makeLlmCall } from "@/adapters/llm";
import { personalityRoute } from "./handler";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const key = env.ANTHROPIC_API_KEY as string | undefined;
  const llm = key === undefined || key === "" ? null : makeLlmCall(key, { primary: env.LLM_MODEL_PRIMARY, verify: env.LLM_MODEL_VERIFY });
  return personalityRoute(request, env, id, { llm, ledger: makeLedgerAppend(env.DB), now: () => Date.now() });
}
