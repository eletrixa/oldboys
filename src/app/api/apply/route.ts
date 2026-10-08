/**
 * POST /api/apply: the hosted apply page's entry point; hands the request and bindings to handleApply.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/apply/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext)
 * Tested:  src/app/api/apply/__tests__/apply.test.ts (via handler.ts)
 *
 * Key responsibilities:
 * - Public, unauthenticated endpoint for /apply/<tag>; no bearer token ships to or is needed by the browser
 *
 * Design constraints:
 * - No runtime = "edge"; all logic lives in handler.ts
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleApply } from "./handler";

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  return handleApply(request, env, new Date());
}
