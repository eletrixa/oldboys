/**
 * POST /api/calls/:id/approve: operator consent gate; places the call and starts VerificationCallWorkflow.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/calls/[id]/approve/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), zod, src/domain/call, src/workflow/calls, bindings DB + SOURCES + VERIFY_CALL
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Bearer auth; validate consent; one conditional UPDATE enforces drafted-only and RUN_CALL_MAX
 * - placeCall exactly once here (never from a retried Workflow step); mock result goes to R2
 *
 * Design constraints:
 * - The full to_number is a local of this handler: never logged, stored, or passed to the Workflow
 * - No runtime = "edge"
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { requireBearer } from "@/app/api/_lib/auth";
import { maskNumber, transitionCall } from "@/domain/call";
import { callResultR2Key, loadCall, selectCallProvider } from "@/workflow/calls";
import { appendLedger } from "@/workflow/ledger";

const ApproveBody = z.object({
  to_number: z.string().regex(/^\+[1-9]\d{6,14}$/),
  consent_ack: z.literal(true),
  consent_note: z.string().min(1).max(500),
  operator: z.string().min(1).max(100),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { env } = getCloudflareContext();
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return denied;

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const parsed = ApproveBody.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  const call = await loadCall(env.DB, id);
  if (!call) return Response.json({ error: "call not found" }, { status: 404 });

  const callMax = Number(env.RUN_CALL_MAX) || 2;
  const claimed = await env.DB.prepare(
    `UPDATE calls SET status = 'dialing', consent_ack = 1, consent_note = ?, operator = ?, to_number_masked = ?, approved_at = ?
     WHERE id = ? AND status = 'drafted'
       AND (SELECT COUNT(*) FROM calls WHERE run_id = ? AND status NOT IN ('drafted', 'skipped')) < ?`,
  )
    .bind(body.consent_note, body.operator, maskNumber(body.to_number), new Date().toISOString(), id, call.run_id, callMax)
    .run();
  if (claimed.meta.changes !== 1) {
    return Response.json({ error: "call is not drafted or the run reached RUN_CALL_MAX" }, { status: 409 });
  }

  const bundle = selectCallProvider(env);
  const started = Date.now();
  let placed: Awaited<ReturnType<typeof bundle.placeCall>>;
  try {
    placed = await bundle.placeCall({ callId: id, toNumber: body.to_number, brief: call.brief });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown provider error";
    await env.DB.prepare("UPDATE calls SET status = 'failed', failure_reason = ?, finished_at = ? WHERE id = ?")
      .bind(reason, new Date().toISOString(), id)
      .run();
    await appendLedger(env.DB, call.run_id, {
      step: "call:dial",
      kind: "decision",
      cost_usd: 0,
      ms: Date.now() - started,
      ref: { type: "phone", callId: id, failed: true, reason },
    });
    return Response.json({ error: "provider call failed", id }, { status: 502 });
  }

  let status = transitionCall("drafted", { type: "approve" });
  const { result } = placed;
  if (result) {
    const key = callResultR2Key(call.run_id, id);
    await env.SOURCES.put(key, JSON.stringify(result));
    status = transitionCall(status, { type: "result", outcome: result.outcome });
    const flag = (v: boolean | null): number | null => (v === null ? null : Number(v));
    await env.DB.prepare(
      `UPDATE calls SET provider_conversation_id = ?, result_r2_key = ?, status = ?, call_successful = ?,
         identity_confirmed = ?, duration_secs = ?, cost_usd = ?, finished_at = ? WHERE id = ?`,
    )
      .bind(
        placed.provider_conversation_id,
        key,
        status,
        flag(result.call_successful),
        flag(result.identity_confirmed),
        result.duration_secs,
        result.cost_usd,
        new Date().toISOString(),
        id,
      )
      .run();
  } else {
    await env.DB.prepare("UPDATE calls SET provider_conversation_id = ? WHERE id = ?")
      .bind(placed.provider_conversation_id, id)
      .run();
  }

  await appendLedger(env.DB, call.run_id, {
    step: "call:dial",
    kind: "call",
    cost_usd: 0,
    ms: Date.now() - started,
    ref: {
      type: "phone",
      callId: id,
      provider: bundle.provider,
      mock: bundle.provider === "mock",
      questions: call.brief.questions.length,
    },
  });

  await env.VERIFY_CALL.create({ id, params: { callId: id, runId: call.run_id } });
  return Response.json({ id, status, provider: bundle.provider }, { status: 202 });
}
