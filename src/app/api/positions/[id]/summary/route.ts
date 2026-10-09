/**
 * GET /api/positions/:id/summary: {id, title, must_haves} of the session's own organization for the start form (no bearer).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/[id]/summary/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), ./summary, binding DB
 * Tested:  src/app/api/positions/[id]/summary/__tests__/summary.test.ts (via summary.ts)
 *
 * Key responsibilities:
 * - Pass the D1 binding and the path id to the tested route function
 *
 * Design constraints:
 * - No runtime = "edge"; no logic here; no bearer by design, session only (see summary.ts)
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPositionSummaryRoute } from "./summary";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return getPositionSummaryRoute(request, getCloudflareContext().env.DB, (await params).id);
}
