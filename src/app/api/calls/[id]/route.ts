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
  return Response.json({
    id: call.id,
    run_id: call.run_id,
    status: call.status,
    provider: call.provider,
    brief: call.brief,
    to_number_masked: call.to_number_masked,
    provider_conversation_id: call.provider_conversation_id,
    call_successful: call.call_successful,
    identity_confirmed: call.identity_confirmed,
    duration_secs: call.duration_secs,
    cost_usd: call.cost_usd,
    failure_reason: call.failure_reason,
    last_error: call.last_error,
    created_at: call.created_at,
    approved_at: call.approved_at,
    finished_at: call.finished_at,
  });
}
