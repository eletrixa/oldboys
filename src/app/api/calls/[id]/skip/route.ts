/**
 * POST /api/calls/:id/skip: the operator declines a drafted call; nothing is dialed.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/calls/[id]/skip/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), src/app/api/_lib/session-or-bearer, src/adapters/d1, src/workflow/calls, bindings DB
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Session or bearer auth (requireSessionOrBearer); drafted -> skipped in one conditional UPDATE (409 otherwise); ledger decision row
 *
 * Design constraints:
 * - No runtime = "edge"
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { makeLedgerAppend } from "@/adapters/d1";
import { requireSessionOrBearer } from "@/app/api/_lib/session-or-bearer";
import { applyCallEvent, loadCall } from "@/workflow/calls";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { env } = getCloudflareContext();
  const denied = await requireSessionOrBearer(request, env);
  if (denied) return denied;

  const { id } = await params;
  const call = await loadCall(env.DB, id);
  if (!call) return Response.json({ error: "call not found" }, { status: 404 });
  const skipped = await applyCallEvent(env.DB, id, { type: "skip" }, { finished_at: new Date().toISOString() }).run();
  if (skipped.meta.changes !== 1) return Response.json({ error: "call is not drafted" }, { status: 409 });

  await makeLedgerAppend(env.DB)({
    run_id: call.run_id,
    step: "call:skip",
    kind: "decision",
    cost_usd: 0,
    ms: 0,
    ref: { type: "phone", callId: id, skipped: true },
  });
  return Response.json({ id, status: "skipped" });
}
