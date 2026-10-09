/**
 * POST /api/runs/:id/delete: delete a run's data now (on rejection or request); logic lives in handler.ts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/delete/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), ./handler, bindings DB + SOURCES + RESEARCH_RUN + VERIFY_CALL, secret RUN_TOKEN
 * Tested:  src/app/api/runs/[id]/delete/__tests__/handler.test.ts (via handler.ts)
 *
 * Key responsibilities:
 * - Pass the request, the run id and the Cloudflare bindings to deleteRunRoute
 *
 * Design constraints:
 * - No runtime = "edge"; no logic here
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { deleteRunRoute } from "./handler";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return deleteRunRoute(request, getCloudflareContext().env, id);
}
