/**
 * POST /api/runs/:id/translate: the brief's own texts in Czech (idea #24); logic lives in handler.ts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/translate/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), ./handler, src/adapters/{llm,d1}, ../../state/load, bindings DB + SOURCES, secrets ANTHROPIC_API_KEY + RUN_TOKEN, vars LLM_MODEL_*
 * Tested:  src/app/api/runs/[id]/translate/__tests__/handler.test.ts (via handler.ts)
 *
 * Key responsibilities:
 * - Wire the Cloudflare bindings and the real ports (LLM adapter, ledger append, state loader) into translateRoute
 *
 * Design constraints:
 * - No runtime = "edge"; no logic here; without ANTHROPIC_API_KEY the LLM port is null (the handler answers 503)
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { makeLedgerAppend } from "@/adapters/d1";
import { makeLlmCall } from "@/adapters/llm";
import { loadRunState } from "../state/load";
import { translateRoute } from "./handler";

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
  return translateRoute(request, env, id, { loadState: loadRunState, llm, ledger: makeLedgerAppend(env.DB), now: () => Date.now() });
}
