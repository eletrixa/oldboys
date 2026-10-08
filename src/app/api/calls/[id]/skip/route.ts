/**
 * POST /api/calls/:id/skip: the operator declines a drafted call; nothing is dialed.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/calls/[id]/skip/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), src/workflow/ledger, bindings DB
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Bearer auth; drafted -> skipped in one conditional UPDATE (409 otherwise); ledger decision row
 *
 * Design constraints:
 * - No runtime = "edge"
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireBearer } from "@/app/api/_lib/auth";
import { appendLedger } from "@/workflow/ledger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { env } = getCloudflareContext();
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return denied;

  const { id } = await params;
  const row = await env.DB.prepare(
    "UPDATE calls SET status = 'skipped', finished_at = ? WHERE id = ? AND status = 'drafted' RETURNING run_id",
  )
    .bind(new Date().toISOString(), id)
    .first<{ run_id: string }>();
  if (!row) return Response.json({ error: "call not found or not drafted" }, { status: 409 });

  await appendLedger(env.DB, row.run_id, {
    step: "call:skip",
    kind: "decision",
    cost_usd: 0,
    ms: 0,
    ref: { type: "phone", callId: id, skipped: true },
  });
  return Response.json({ id, status: "skipped" });
}
