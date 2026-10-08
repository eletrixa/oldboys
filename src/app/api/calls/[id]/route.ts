/**
 * GET /api/calls/:id: public status view of one Verification Call (masked number, no transcript) with its answers.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/calls/[id]/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), src/app/api/runs/[id]/calls/load, binding DB
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Return the call row without consent_note, operator, result key or transcript, plus `answers`
 *   (per-question results from the `call:finish` ledger row; null while still processing)
 *
 * Design constraints:
 * - No auth, like the events route; no runtime = "edge"; never exposes a full phone number
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadCallView } from "@/app/api/runs/[id]/calls/load";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const call = await loadCallView(env.DB, id);
  if (!call) return Response.json({ error: "call not found" }, { status: 404 });
  return Response.json(call, { headers: { "Cache-Control": "no-store" } });
}
