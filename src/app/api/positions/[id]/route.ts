/**
 * GET /api/positions/:id (position, runs, overview group) and PATCH /api/positions/:id (title, family, must-haves).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/[id]/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), ../routes, binding DB, secret RUN_TOKEN
 * Tested:  src/app/api/positions/__tests__/handler.test.ts (via routes.ts)
 *
 * Key responsibilities:
 * - Pass the request, bindings and the path id to the tested route functions
 *
 * Design constraints:
 * - No runtime = "edge"; no logic here
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPositionRoute, patchPositionRoute } from "../routes";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return getPositionRoute(request, getCloudflareContext().env, (await params).id);
}

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  return patchPositionRoute(request, getCloudflareContext().env, (await params).id);
}
