/**
 * ElevenLabs post-call webhook logic: verify, dedupe, store the result, advance the call, wake the Workflow.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/webhooks/elevenlabs/handler.ts
 * Deps:    src/domain (signature, call), src/workflow (providers/elevenlabs, calls, ledger), bindings DB/SOURCES/VERIFY_CALL
 * Tested:  src/app/api/webhooks/__tests__/elevenlabs.test.ts
 *
 * Key responsibilities:
 * - Verify the signature on the raw body before any JSON parsing
 * - Idempotency per (conversation_id, type) via webhook_events; unknown conversation answers 500 so ElevenLabs retries
 * - Persist the raw result to R2, update calls and webhook_events in one D1 batch, append a ledger row
 * - Send the 'call-result' event to the paused VerificationCallWorkflow (the poll fallback covers a failed send)
 *
 * Design constraints:
 * - Takes bindings and the clock as parameters so tests run under plain Node; no Next.js imports
 * - An illegal status transition is recorded as stale and never updates the call
 */
import { CallStatus, IllegalCallTransition, transitionCall } from "@/domain/call";
import { verifyElevenLabsSignature } from "@/domain/elevenlabs-signature";
import { callResultR2Key } from "@/workflow/calls";
import { appendLedger } from "@/workflow/ledger";
import { parsePostCallWebhook, webhookToResult } from "@/workflow/providers/elevenlabs";

export type WebhookEnv = {
  DB: D1Database;
  SOURCES: R2Bucket;
  VERIFY_CALL: Workflow;
  ELEVENLABS_WEBHOOK_SECRET?: string;
};

// Must match CALL_RESULT_EVENT in src/workflow/verification-call.ts (not imported: that module pulls in Workers-only runtime).
const CALL_RESULT_EVENT = "call-result";

type CallLookup = { id: string; run_id: string; status: string };

function toInt(value: boolean | null): number | null {
  return value === null ? null : value ? 1 : 0;
}

export async function handleElevenLabsWebhook(
  request: Request,
  env: WebhookEnv,
  nowSecs: number = Math.floor(Date.now() / 1000),
): Promise<Response> {
  const secret = env.ELEVENLABS_WEBHOOK_SECRET;
  if (secret === undefined || secret === "") {
    return Response.json({ error: "ELEVENLABS_WEBHOOK_SECRET is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const valid = await verifyElevenLabsSignature({
    rawBody,
    header: request.headers.get("ElevenLabs-Signature"),
    secret,
    nowSecs,
  });
  if (!valid) return Response.json({ error: "invalid signature" }, { status: 401 });

  let event: ReturnType<typeof parsePostCallWebhook>;
  try {
    event = parsePostCallWebhook(JSON.parse(rawBody));
  } catch {
    return Response.json({ error: "invalid webhook body" }, { status: 400 });
  }
  if (event.type === "post_call_audio") return Response.json({ ok: true, ignored: true });

  const conversationId = event.data.conversation_id;
  const call = await env.DB.prepare("SELECT id, run_id, status FROM calls WHERE provider_conversation_id = ?")
    .bind(conversationId)
    .first<CallLookup>();
  // Deliberate 5xx: ElevenLabs retries, and the approve route may not have committed the conversation id yet.
  if (!call) return Response.json({ error: "unknown conversation" }, { status: 500 });

  const seen = await env.DB.prepare("SELECT 1 FROM webhook_events WHERE conversation_id = ? AND type = ?")
    .bind(conversationId, event.type)
    .first();
  if (seen) return Response.json({ ok: true, duplicate: true });

  const result = webhookToResult(event);
  if (result === null) return Response.json({ ok: true, ignored: true });

  const r2Key = callResultR2Key(call.run_id, call.id);
  await env.SOURCES.put(r2Key, JSON.stringify(result));

  const recordEvent = env.DB.prepare(
    "INSERT INTO webhook_events (conversation_id, type, received_at) VALUES (?, ?, ?)",
  ).bind(conversationId, event.type, new Date(nowSecs * 1000).toISOString());

  let newStatus: string;
  try {
    newStatus = transitionCall(CallStatus.parse(call.status), {
      type: "result",
      outcome: result.outcome,
    });
  } catch (error) {
    if (!(error instanceof IllegalCallTransition)) throw error;
    await recordEvent.run();
    return Response.json({ ok: true, stale: true });
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE calls SET result_r2_key = ?, status = ?, call_successful = ?, identity_confirmed = ?,
         duration_secs = ?, cost_usd = ?, failure_reason = ?, finished_at = ? WHERE id = ?`,
    ).bind(
      r2Key,
      newStatus,
      toInt(result.call_successful),
      toInt(result.identity_confirmed),
      result.duration_secs,
      result.cost_usd,
      result.failure_reason,
      new Date(nowSecs * 1000).toISOString(),
      call.id,
    ),
    recordEvent,
  ]);

  await appendLedger(env.DB, call.run_id, {
    step: "call:webhook",
    kind: "call",
    cost_usd: result.cost_usd,
    ms: 0,
    ref: { type: "phone", callId: call.id, event: event.type, outcome: result.outcome },
  });

  try {
    const instance = await env.VERIFY_CALL.get(call.id);
    await instance.sendEvent({ type: CALL_RESULT_EVENT, payload: { conversation_id: conversationId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`call-result sendEvent failed for ${call.id}: ${message}`);
    await env.DB.prepare("UPDATE calls SET last_error = ? WHERE id = ?").bind(message, call.id).run();
  }

  return Response.json({ ok: true, id: call.id, status: newStatus });
}
