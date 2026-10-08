/**
 * POST /api/positions (ingest a posting) and GET /api/positions (list); logic lives in handler.ts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), ./handler, bindings DB + SOURCES, secrets RUN_TOKEN + ANTHROPIC_API_KEY
 * Tested:  src/app/api/positions/__tests__/handler.test.ts (via handler.ts)
 *
 * Key responsibilities:
 * - Pass the request and Cloudflare bindings to the tested route functions
 *
 * Design constraints:
 * - No runtime = "edge"; no logic here
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createPositionRoute, listPositionsRoute } from "./handler";

export async function POST(request: Request): Promise<Response> {
  return createPositionRoute(request, getCloudflareContext().env);
}

export async function GET(request: Request): Promise<Response> {
  return listPositionsRoute(request, getCloudflareContext().env);
}
