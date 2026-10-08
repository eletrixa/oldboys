/**
 * GET /api/calls/:id: public status view of one Verification Call (masked number, no transcript).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/calls/[id]/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), src/workflow/calls, binding DB
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Return the call row without consent_note, operator, result key or transcript
 *
 * Design constraints:
 * - No auth, like the events route; no runtime = "edge"; never exposes a full phone number
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadCall } from "@/workflow/calls";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const call = await loadCall(env.DB, id);
  if (!call) return Response.json({ error: "call not found" }, { status: 404 });
  // Never the consent note, operator, R2 key or transcript; the number is already masked.
  const { consent_note: _note, operator: _operator, result_r2_key: _key, consent_ack: _ack, ...publicCall } = call;
  return Response.json(publicCall);
}
