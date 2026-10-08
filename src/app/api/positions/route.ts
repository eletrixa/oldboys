/**
 * POST /api/positions (ingest a posting) and GET /api/positions (list); logic lives in routes.ts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), ./routes, bindings DB + SOURCES, secrets RUN_TOKEN + ANTHROPIC_API_KEY
 * Tested:  src/app/api/positions/__tests__/handler.test.ts (via routes.ts)
 *
 * Key responsibilities:
 * - Pass the request and Cloudflare bindings to the tested route functions
 *
 * Design constraints:
 * - No runtime = "edge"; no logic here
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createPositionRoute, listPositionsRoute } from "./routes";

export async function POST(request: Request): Promise<Response> {
  return createPositionRoute(request, getCloudflareContext().env);
}

export async function GET(request: Request): Promise<Response> {
  return listPositionsRoute(request, getCloudflareContext().env);
}
