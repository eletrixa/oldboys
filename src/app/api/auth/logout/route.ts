/**
 * POST /api/auth/logout.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/auth/logout/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext)
 * Tested:  src/app/api/auth/__tests__/auth.test.ts
 *
 * Key responsibilities:
 * - Pass the request and bindings to handleLogout
 *
 * Design constraints:
 * - No runtime = "edge"; all logic lives in handler.ts
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleLogout } from "./handler";

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  return handleLogout(request, env);
}
