/**
 * POST /api/auth/register.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/auth/register/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext)
 * Tested:  src/app/api/auth/__tests__/auth.test.ts
 *
 * Key responsibilities:
 * - Pass the request and bindings to handleRegister
 *
 * Design constraints:
 * - No runtime = "edge"; all logic lives in handler.ts
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleRegister } from "./handler";

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  return handleRegister(request, env);
}
