/**
 * Call persistence helpers shared by the call routes and VerificationCallWorkflow: row mapping,
 * provider selection, R2 key and source URL conventions.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/calls.ts
 * Deps:    D1 binding (global D1Database type), src/domain/call, src/workflow/providers/*
 * Tested:  src/workflow/__tests__/calls.test.ts
 *
 * Key responsibilities:
 * - One place that knows the `calls` column list and the INTEGER 0/1 <-> boolean mapping
 * - Pick the provider from CALL_PROVIDER (mock unless `elevenlabs` and its config is complete)
 *
 * Design constraints:
 * - Imports only src/domain and src/workflow, never Next.js
 * - Never exposes a phone number: rows carry `to_number_masked` only
 */
import { Call, type CallProvider } from "@/domain/call";
import type { FetchCallResult, PlaceCall } from "@/domain/ports";
import {
  elevenLabsFetchCallResult,
  elevenLabsPlaceCall,
  type ElevenLabsConfig,
} from "@/workflow/providers/elevenlabs";
import {
  ELEVENLABS_SOURCE_ACTOR,
  MOCK_SOURCE_ACTOR,
  mockPlaceCall,
} from "@/workflow/providers/mock-call";

export const CALL_COLUMNS =
  "id, run_id, status, provider, provider_conversation_id, to_number_masked, consent_ack, consent_note, operator, brief_json, result_r2_key, call_successful, identity_confirmed, duration_secs, cost_usd, failure_reason, last_error, created_at, approved_at, finished_at";

/** Raw D1 row of `calls`; booleans are INTEGER 0/1, brief is JSON text. */
export type CallRow = {
  id: string;
  run_id: string;
  status: string;
  provider: string;
  provider_conversation_id: string | null;
  to_number_masked: string | null;
  consent_ack: number;
  consent_note: string | null;
  operator: string | null;
  brief_json: string;
  result_r2_key: string | null;
  call_successful: number | null;
  identity_confirmed: number | null;
  duration_secs: number | null;
  cost_usd: number;
  failure_reason: string | null;
  last_error: string | null;
  created_at: string;
  approved_at: string | null;
  finished_at: string | null;
};

const toBool = (v: number | null): boolean | null => (v === null ? null : v !== 0);

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
  const row = await db.prepare(`SELECT ${CALL_COLUMNS} FROM calls WHERE id = ?`).bind(id).first<CallRow>();
  return row ? rowToCall(row) : null;
}

/** R2 key of the raw provider payload (webhook body or mock result) for one call. */
export function callResultR2Key(runId: string, callId: string): string {
  return `oldboys-sources/${runId}/call-${callId}.json`;
}

/** URL stored on the transcript Source: the ElevenLabs history page, or a non-resolving mock URL. */
export function callSourceUrl(provider: CallProvider, conversationId: string): string {
  return provider === "elevenlabs"
    ? `https://elevenlabs.io/app/conversational-ai/history/${conversationId}`
    : `https://mock.invalid/call/${conversationId}`;
}

export type CallProviderBundle = {
  provider: CallProvider;
  placeCall: PlaceCall;
  fetchResult: FetchCallResult;
  sourceActor: string;
};

export type CallProviderEnv = {
  CALL_PROVIDER?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_AGENT_ID?: string;
  ELEVENLABS_PHONE_NUMBER_ID?: string;
};

/** `elevenlabs` only when asked for AND fully configured; otherwise the labeled mock. */
export function selectCallProvider(env: CallProviderEnv, fetchImpl?: typeof fetch): CallProviderBundle {
  const cfg: ElevenLabsConfig = {
    apiKey: env.ELEVENLABS_API_KEY ?? "",
    agentId: env.ELEVENLABS_AGENT_ID ?? "",
    phoneNumberId: env.ELEVENLABS_PHONE_NUMBER_ID ?? "",
    fetchImpl,
  };
  const live =
    env.CALL_PROVIDER === "elevenlabs" &&
    cfg.apiKey.length > 0 &&
    cfg.agentId.length > 0 &&
    cfg.phoneNumberId.length > 0;
  if (live) {
    return {
      provider: "elevenlabs",
      placeCall: elevenLabsPlaceCall(cfg),
      fetchResult: elevenLabsFetchCallResult(cfg),
      sourceActor: ELEVENLABS_SOURCE_ACTOR,
    };
  }
  return {
    provider: "mock",
    placeCall: mockPlaceCall(),
    fetchResult: () => Promise.resolve(null),
    sourceActor: MOCK_SOURCE_ACTOR,
  };
}
