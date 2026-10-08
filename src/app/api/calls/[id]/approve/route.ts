/**
 * POST /api/calls/:id/approve: operator consent gate; places the call and starts VerificationCallWorkflow.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/calls/[id]/approve/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), zod, src/domain/call, src/workflow/calls, src/adapters/d1, bindings DB + SOURCES + VERIFY_CALL
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Bearer auth; validate consent; one conditional UPDATE enforces drafted-only and RUN_CALL_MAX
 * - placeCall exactly once here (never from a retried Workflow step); a mock result is persisted at once
 *
 * Design constraints:
 * - The full to_number is a local of this handler: never logged, stored, or passed to the Workflow
 * - The provider is the one stored on the call when it was drafted
 * - No runtime = "edge"
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { makeLedgerAppend } from "@/adapters/d1";
import { requireBearer } from "@/app/api/_lib/auth";
import { parseJsonBody } from "@/app/api/_lib/body";
import { type CallStatus, maskNumber } from "@/domain/call";
import { applyCallEvent, callResultR2Key, failCall, loadCall, providerFor, recordCallResult } from "@/workflow/calls";

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
  const body = await parseJsonBody(request, ApproveBody);
  if (body.error) return body.error;

  const call = await loadCall(env.DB, id);
  if (!call) return Response.json({ error: "call not found" }, { status: 404 });

  const callMax = Number(env.RUN_CALL_MAX) || 2;
  const claimed = await applyCallEvent(
    env.DB,
    id,
    { type: "approve" },
    {
      consent_ack: 1,
      consent_note: body.data.consent_note,
      operator: body.data.operator,
      to_number_masked: maskNumber(body.data.to_number),
      approved_at: new Date().toISOString(),
    },
    {
      sql: " AND (SELECT COUNT(*) FROM calls WHERE run_id = ? AND status NOT IN ('drafted', 'skipped')) < ?",
      binds: [call.run_id, callMax],
    },
  ).run();
  if (claimed.meta.changes !== 1) {
    return Response.json({ error: "call is not drafted or the run reached RUN_CALL_MAX" }, { status: 409 });
  }

  const ledger = makeLedgerAppend(env.DB);
  const started = Date.now();
  let placed: Awaited<ReturnType<ReturnType<typeof providerFor>["placeCall"]>>;
  try {
    placed = await providerFor(call.provider, env).placeCall({ callId: id, toNumber: body.data.to_number, brief: call.brief });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown provider error";
    await failCall(env.DB, id, reason);
    await ledger({
      run_id: call.run_id,
      step: "call:dial",
      kind: "decision",
      cost_usd: 0,
      ms: Date.now() - started,
      ref: { type: "phone", callId: id, failed: true, reason },
    });
    return Response.json({ error: "provider call failed", id }, { status: 502 });
  }

  let status: CallStatus = "dialing";
  if (placed.result) {
    const key = callResultR2Key(call.run_id, id);
    await env.SOURCES.put(key, JSON.stringify(placed.result));
    await recordCallResult(env.DB, id, placed.result, key, new Date().toISOString()).run();
    status = placed.result.outcome;
  } else {
    await env.DB.prepare("UPDATE calls SET provider_conversation_id = ? WHERE id = ?")
      .bind(placed.provider_conversation_id, id)
      .run();
  }

  await ledger({
    run_id: call.run_id,
    step: "call:dial",
    kind: "call",
    cost_usd: 0,
    ms: Date.now() - started,
    ref: {
      type: "phone",
      callId: id,
      provider: call.provider,
      mock: call.provider === "mock",
      questions: call.brief.questions.length,
    },
  });

  try {
    await env.VERIFY_CALL.create({ id, params: { callId: id, runId: call.run_id } });
  } catch (error) {
    // The call is already placed; record why nothing will ingest its result instead of losing that fact.
    const reason = error instanceof Error ? error.message : String(error);
    await env.DB.prepare("UPDATE calls SET last_error = ? WHERE id = ?").bind(`workflow not started: ${reason}`, id).run();
    return Response.json({ error: "call placed but the result workflow could not start", id }, { status: 500 });
  }
  return Response.json({ id, status, provider: call.provider }, { status: 202 });
}
