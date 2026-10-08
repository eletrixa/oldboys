/**
 * POST /api/intake/form: Google Forms (Apps Script) application entry point.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/intake/form/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext)
 * Tested:  src/app/api/intake/__tests__/form.test.ts (via handler.ts)
 *
 * Key responsibilities:
 * - Pass the request, Cloudflare bindings and the clock to handleFormIntake
 *
 * Design constraints:
 * - No runtime = "edge"; all logic lives in handler.ts
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleFormIntake } from "./handler";

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  return handleFormIntake(request, env, new Date());
}
