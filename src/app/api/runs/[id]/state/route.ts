/**
 * GET /api/runs/:id/state: one-shot projection of a run for the brief page poller; the projection lives in load.ts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/state/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), bindings DB, ./load
 * Tested:  src/app/api/runs/[id]/state/__tests__/route.test.ts
 *
 * Key responsibilities:
 * - 404 for an unknown run, else the RunState as JSON
 *
 * Design constraints:
 * - No runtime = "edge"; never cached; no auth (the id is an unguessable UUID, like GET /api/runs/:id)
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadRunState } from "./load";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const state = await loadRunState(getCloudflareContext().env.DB, id);
  if (state === null) return Response.json({ error: "run not found" }, { status: 404 });
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
