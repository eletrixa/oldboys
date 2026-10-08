/**
 * Call persistence shared by the call routes, the webhook and VerificationCallWorkflow: row mapping,
 * the atomic status guard, result persistence, provider lookup, R2 key and Source conventions.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/calls.ts
 * Deps:    D1 binding (global D1Database type), src/domain/call, src/workflow/providers/*
 * Tested:  src/workflow/__tests__/calls.test.ts
 *
 * Key responsibilities:
 * - `applyCallEvent` is the SQL form of the status machine: `WHERE status IN (allowedFrom)` so every
 *   writer (approve, skip, webhook, poll, fail) gets the same atomic guard; `meta.changes === 0` means stale
 * - `recordCallResult` is the only statement that writes a CallResult into `calls`
 * - The provider of a call is the one stored on its row; `providerFor` never silently downgrades to mock
 *
 * Design constraints:
 * - Imports only src/domain and src/workflow (no cloudflare:workers, so routes and Node tests can import it)
 * - Never exposes a phone number: rows carry `to_number_masked` only
 */
import {
  allowedFrom,
  Call,
  type CallEvent,
  type CallProvider,
  type CallResult,
  targetStatus,
} from "@/domain/call";
import type { FetchCallResult, PlaceCall } from "@/domain/ports";
import { elevenLabsFetchCallResult, elevenLabsPlaceCall } from "@/workflow/providers/elevenlabs";
import { mockPlaceCall } from "@/workflow/providers/mock-call";

/** Event type the webhook sends and VerificationCallWorkflow waits for. */
export const CALL_RESULT_EVENT = "call-result";
export type CallResultEvent = { conversation_id: string };

/** Source.actor per provider; "mock/convai" is the MOCK label the report shows. */
export const CALL_SOURCE_ACTOR: Record<CallProvider, string> = {
  elevenlabs: "elevenlabs/convai",
  mock: "mock/convai",
};

/** Raw D1 row of `calls`; booleans are INTEGER 0/1, brief is JSON text. */
export type CallRow = Omit<Call, "brief" | "consent_ack" | "call_successful" | "identity_confirmed"> & {
  brief_json: string;
  consent_ack: number;
  call_successful: number | null;
  identity_confirmed: number | null;
};

const toBool = (v: number | null): boolean | null => (v === null ? null : v !== 0);
const toBit = (v: boolean | null): number | null => (v === null ? null : v ? 1 : 0);

export function rowToCall(row: CallRow): Call {
  const { brief_json, consent_ack, call_successful, identity_confirmed, ...rest } = row;
  return Call.parse({
    ...rest,
    brief: JSON.parse(brief_json) as unknown,
    consent_ack: consent_ack !== 0,
    call_successful: toBool(call_successful),
    identity_confirmed: toBool(identity_confirmed),
  });
}

export async function loadCall(db: D1Database, id: string): Promise<Call | null> {
  const row = await db.prepare("SELECT * FROM calls WHERE id = ?").bind(id).first<CallRow>();
  return row ? rowToCall(row) : null;
}

/** Source id and R2 key of the transcript; the key matches makeSourceStore's `<run>/<source>.json`. */
export function callSourceId(callId: string): string {
  return `src-call-${callId}`;
}

export function callResultR2Key(runId: string, callId: string): string {
  return `${runId}/${callSourceId(callId)}.json`;
}

/** URL stored on the transcript Source: the ElevenLabs history page, or a non-resolving mock URL. */
export function callSourceUrl(provider: CallProvider, conversationId: string): string {
  return provider === "elevenlabs"
    ? `https://elevenlabs.io/app/conversational-ai/history/${conversationId}`
    : `https://mock.invalid/call/${conversationId}`;
}

export type CallProviderEnv = {
  CALL_PROVIDER?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_AGENT_ID?: string;
  ELEVENLABS_PHONE_NUMBER_ID?: string;
};

function elevenLabsConfig(env: CallProviderEnv, fetchImpl?: typeof fetch) {
  return {
    apiKey: env.ELEVENLABS_API_KEY ?? "",
    agentId: env.ELEVENLABS_AGENT_ID ?? "",
    phoneNumberId: env.ELEVENLABS_PHONE_NUMBER_ID ?? "",
    fetchImpl,
  };
}

function elevenLabsConfigured(env: CallProviderEnv): boolean {
  const cfg = elevenLabsConfig(env);
  return cfg.apiKey.length > 0 && cfg.agentId.length > 0 && cfg.phoneNumberId.length > 0;
}

/** Decided once, when a call is drafted: `elevenlabs` only when asked for AND fully configured. */
export function selectCallProvider(env: CallProviderEnv): CallProvider {
  return env.CALL_PROVIDER === "elevenlabs" && elevenLabsConfigured(env) ? "elevenlabs" : "mock";
}

/** The adapters for the provider stored on the call row; throws instead of downgrading a live call to mock. */
export function providerFor(
  provider: CallProvider,
  env: CallProviderEnv,
  fetchImpl?: typeof fetch,
): { placeCall: PlaceCall; fetchResult: FetchCallResult } {
  if (provider === "mock") {
    return { placeCall: mockPlaceCall(), fetchResult: () => Promise.resolve(null) };
  }
  if (!elevenLabsConfigured(env)) throw new Error("ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID and ELEVENLABS_PHONE_NUMBER_ID must be set");
  const cfg = elevenLabsConfig(env, fetchImpl);
  return { placeCall: elevenLabsPlaceCall(cfg), fetchResult: elevenLabsFetchCallResult(cfg) };
}

type ColumnValue = string | number | null;

/**
 * UPDATE calls SET status = <target>, ...set WHERE id = ? AND status IN (<allowedFrom>) [AND extra].
 * Run it and read `meta.changes`: 0 means the call was not in an allowed status (stale or duplicate).
 */
export function applyCallEvent(
  db: D1Database,
  callId: string,
  event: CallEvent,
  set: Record<string, ColumnValue> = {},
  extraWhere: { sql: string; binds: ColumnValue[] } = { sql: "", binds: [] },
): D1PreparedStatement {
  const columns = Object.keys(set);
  const assignments = ["status = ?", ...columns.map((c) => `${c} = ?`)].join(", ");
  const from = allowedFrom(event.type);
  const sql = `UPDATE calls SET ${assignments} WHERE id = ? AND status IN (${from.map(() => "?").join(", ")})${extraWhere.sql}`;
  return db
    .prepare(sql)
    .bind(targetStatus(event), ...columns.map((c) => set[c] ?? null), callId, ...from, ...extraWhere.binds);
}

/** The one statement that persists a CallResult (mock at approve time, webhook, or poll). */
export function recordCallResult(
  db: D1Database,
  callId: string,
  result: CallResult,
  r2Key: string,
  finishedAt: string,
): D1PreparedStatement {
  return applyCallEvent(db, callId, { type: "result", outcome: result.outcome }, {
    provider_conversation_id: result.provider_conversation_id,
    result_r2_key: r2Key,
    call_successful: toBit(result.call_successful),
    identity_confirmed: toBit(result.identity_confirmed),
    duration_secs: result.duration_secs,
    cost_usd: result.cost_usd,
    failure_reason: result.failure_reason,
    finished_at: finishedAt,
  });
}

/** Mark a dialing call failed with a reason; a call already terminal only gets `last_error`. */
export async function failCall(db: D1Database, callId: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  const failed = await applyCallEvent(db, callId, { type: "fail" }, {
    failure_reason: reason,
    last_error: reason,
    finished_at: now,
  }).run();
  if (failed.meta.changes === 0) {
    await db.prepare("UPDATE calls SET last_error = ? WHERE id = ?").bind(reason, callId).run();
  }
}

/** Wake the Workflow instance; returns the error message instead of throwing (the poll fallback covers it). */
export async function notifyCallResult(
  workflows: Workflow,
  callId: string,
  conversationId: string,
): Promise<string | null> {
  try {
    const instance = await workflows.get(callId);
    const payload: CallResultEvent = { conversation_id: conversationId };
    await instance.sendEvent({ type: CALL_RESULT_EVENT, payload });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
