/**
 * ElevenLabs post-call webhook logic: verify, dedupe, store the result, advance the call, wake the Workflow.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/webhooks/elevenlabs/handler.ts
 * Deps:    src/domain (signature), src/workflow (providers/elevenlabs, calls), src/adapters/d1, bindings DB/SOURCES/VERIFY_CALL
 * Tested:  src/app/api/webhooks/__tests__/elevenlabs.test.ts
 *
 * Key responsibilities:
 * - Verify the signature on the raw body before any JSON parsing
 * - Idempotency per (conversation_id, type) via webhook_events; unknown conversation answers 500 so ElevenLabs retries
 * - Persist the result to R2, then `recordCallResult` + webhook_events in one D1 batch; the status guard is in SQL
 * - Send the 'call-result' event to the waiting VerificationCallWorkflow (the poll fallback covers a failed send)
 *
 * Design constraints:
 * - Takes bindings and the clock as parameters so tests run under plain Node; no Next.js imports
 * - A result for a call that is already terminal is recorded as stale and never overwrites the call
 */
import { makeLedgerAppend } from "@/adapters/d1";
import { verifyElevenLabsSignature } from "@/domain/elevenlabs-signature";
import { callResultR2Key, notifyCallResult, recordCallResult } from "@/workflow/calls";
import { parsePostCallWebhook, webhookToResult } from "@/workflow/providers/elevenlabs";

export type WebhookEnv = {
  DB: D1Database;
  SOURCES: R2Bucket;
  VERIFY_CALL: Workflow;
  ELEVENLABS_WEBHOOK_SECRET?: string;
};

type CallLookup = { id: string; run_id: string };

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
  const [lookup, seen] = await env.DB.batch<CallLookup>([
    env.DB.prepare("SELECT id, run_id FROM calls WHERE provider_conversation_id = ?").bind(conversationId),
    env.DB.prepare("SELECT conversation_id AS id, type AS run_id FROM webhook_events WHERE conversation_id = ? AND type = ?").bind(conversationId, event.type),
  ]);
  const call = lookup?.results[0];
  // Deliberate 5xx: ElevenLabs retries, and the approve route may not have committed the conversation id yet.
  if (!call) return Response.json({ error: "unknown conversation" }, { status: 500 });
  if ((seen?.results.length ?? 0) > 0) return Response.json({ ok: true, duplicate: true });

  const result = webhookToResult(event);
  if (result === null) return Response.json({ ok: true, ignored: true });

  const r2Key = callResultR2Key(call.run_id, call.id);
  await env.SOURCES.put(r2Key, JSON.stringify(result));

  const receivedAt = new Date(nowSecs * 1000).toISOString();
  const [updated] = await env.DB.batch([
    recordCallResult(env.DB, call.id, result, r2Key, receivedAt),
    env.DB.prepare("INSERT INTO webhook_events (conversation_id, type, received_at) VALUES (?, ?, ?)").bind(conversationId, event.type, receivedAt),
  ]);
  if ((updated?.meta.changes ?? 0) === 0) return Response.json({ ok: true, stale: true });

  await makeLedgerAppend(env.DB)({
    run_id: call.run_id,
    step: "call:webhook",
    kind: "call",
    cost_usd: result.cost_usd,
    ms: 0,
    ref: { type: "phone", callId: call.id, event: event.type, outcome: result.outcome },
  });

  const sendError = await notifyCallResult(env.VERIFY_CALL, call.id, conversationId);
  if (sendError !== null) {
    console.warn(`call-result sendEvent failed for ${call.id}: ${sendError}`);
    await env.DB.prepare("UPDATE calls SET last_error = ? WHERE id = ?").bind(sendError, call.id).run();
  }

  return Response.json({ ok: true, id: call.id, status: result.outcome });
}
