/**
 * POST /api/runs: bearer-authenticated run creation for the extension, curl and operators.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), src/app/api/_lib/auth, src/app/api/runs/handler, secret RUN_TOKEN
 * Tested:  src/app/api/runs/__tests__/handler.test.ts
 *
 * Key responsibilities:
 * - Bearer auth against secret RUN_TOKEN (401 when missing or wrong, 503 when the secret is unset)
 * - Delegates everything else to createRun with origin via = api (account and organization stay NULL); positionId, caps and dedupe live there too
 *
 * Design constraints:
 * - No runtime = "edge"
 * - Thin: validation, caps and insert live in handler.ts
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireBearer } from "@/app/api/_lib/auth";
import { createRun } from "@/app/api/runs/handler";

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return denied;
  return createRun(request, env, { via: "api" });
}
