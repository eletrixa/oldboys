/**
 * ElevenLabs Conversational AI adapter: place an outbound call, fetch a result, map webhooks.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/providers/elevenlabs.ts
 * Deps:    zod, plain fetch (no ElevenLabs SDK)
 * Tested:  src/workflow/__tests__/elevenlabs.test.ts
 *
 * Key responsibilities:
 * - `elevenLabsPlaceCall` implements PlaceCall; `elevenLabsFetchCallResult` implements FetchCallResult
 * - `parsePostCallWebhook` / `webhookToResult` turn a verified webhook body into a CallResult
 * - The outbound call overrides the agent's system prompt and first message with the brief's
 *   `agent_prompt` / `first_message` (older briefs: the script and its first line)
 *
 * Design constraints:
 * - Imports only src/domain and zod; `fetchImpl` is injectable so tests never hit the network
 * - Signature verification lives in src/domain/elevenlabs-signature.ts, not here
 * - The full phone number goes to the provider only; nothing here persists it
 */
import { z } from "zod";
import type { CallResult } from "@/domain/call";
import type { FetchCallResult, PlaceCall } from "@/domain/ports";

export const ELEVENLABS_API = "https://api.elevenlabs.io";

export type ElevenLabsConfig = {
  apiKey: string;
  agentId: string;
  phoneNumberId: string;
  fetchImpl?: typeof fetch;
};

const OutboundResponse = z.object({
  conversation_id: z.string().nullish(),
  callSid: z.string().nullish(),
  success: z.boolean().optional(),
  message: z.string().optional(),
});

/** Bound wrapper: a bare `fetch` reference throws "Illegal invocation" on Workers. */
function doFetch(cfg: ElevenLabsConfig): typeof fetch {
  return cfg.fetchImpl ?? ((input, init) => fetch(input, init));
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function elevenLabsPlaceCall(cfg: ElevenLabsConfig): PlaceCall {
  return async ({ callId, toNumber, brief }) => {
    const res = await doFetch(cfg)(`${ELEVENLABS_API}/v1/convai/twilio/outbound-call`, {
      method: "POST",
      headers: { "xi-api-key": cfg.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: cfg.agentId,
        agent_phone_number_id: cfg.phoneNumberId,
        to_number: toNumber,
        conversation_initiation_client_data: {
          dynamic_variables: { call_id: callId, subject_language: brief.language },
          conversation_config_override: {
            agent: {
              // Briefs drafted before first_message / agent_prompt existed fall back to the script.
              prompt: { prompt: brief.agent_prompt ?? brief.script },
              first_message: brief.first_message ?? brief.script.split("\n")[0],
              language: brief.language,
            },
          },
        },
      }),
    });
    const text = await res.text();
    const parsed = res.ok ? OutboundResponse.safeParse(tryJson(text)) : null;
    const conversationId = parsed?.success === true ? parsed.data.conversation_id : null;
    if (conversationId === null || conversationId === undefined || conversationId === "") {
      throw new Error(`elevenlabs outbound-call failed: ${String(res.status)} ${text}`);
    }
    return { provider_conversation_id: conversationId, result: null };
  };
}

const Transcript = z.array(
  z.object({
    role: z.enum(["agent", "user"]),
    message: z.string().nullable(),
    time_in_call_secs: z.number().nullable().optional(),
  }),
);

const Analysis = z
  .object({
    data_collection_results: z.record(z.string(), z.unknown()).optional(),
    call_successful: z.string().optional(),
    transcript_summary: z.string().optional(),
  })
  .loose();

export const PostCallWebhook = z.object({
  type: z.enum(["post_call_transcription", "post_call_audio", "call_initiation_failure"]),
  event_timestamp: z.number().optional(),
  data: z
    .object({
      agent_id: z.string().optional(),
      conversation_id: z.string().min(1),
      status: z.string().optional(),
      transcript: Transcript.optional(),
      // `cost` (webhook) has UNCONFIRMED units; `cost_fiat` (GET conversation) is USD.
      metadata: z
        .object({
          call_duration_secs: z.number().optional(),
          cost: z.number().optional(),
          cost_fiat: z.number().nullish(),
        })
        .loose()
        .optional(),
      analysis: Analysis.optional(),
      failure_reason: z.string().optional(),
    })
    .loose(),
});
export type PostCallWebhook = z.infer<typeof PostCallWebhook>;

export function parsePostCallWebhook(json: unknown): PostCallWebhook {
  return PostCallWebhook.parse(json);
}

type ConversationData = PostCallWebhook["data"];

/**
 * A data-collection boolean: ElevenLabs sends `{ data_collection_id, value, rationale }` with a boolean or a
 * "true"/"false" string as `value`; a bare boolean is accepted too. Anything else is null ("ask the extractor").
 */
export function dataCollectionBoolean(raw: unknown): boolean | null {
  const value = typeof raw === "object" && raw !== null && "value" in raw ? raw.value : raw;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return null;
}

/** Shared mapping for a finished conversation (webhook `data` and GET body have the same fields). */
function finishedToResult(data: ConversationData, costUsd: number): CallResult {
  const identity = data.analysis?.data_collection_results?.identity_confirmed;
  const verdict = data.analysis?.call_successful;
  return {
    provider_conversation_id: data.conversation_id,
    outcome: data.status === "failed" ? "failed" : "done",
    transcript: (data.transcript ?? []).map((turn) => ({
      role: turn.role,
      message: turn.message ?? "",
      time_in_call_secs: turn.time_in_call_secs ?? 0,
    })),
    call_successful: verdict === "success" ? true : verdict === "failure" ? false : null,
    identity_confirmed: dataCollectionBoolean(identity),
    duration_secs: Math.round(data.metadata?.call_duration_secs ?? 0),
    cost_usd: costUsd,
    failure_reason: null,
  };
}

/** Map a webhook event to a result; null means "ignore" (audio events carry no new information). */
export function webhookToResult(event: PostCallWebhook): CallResult | null {
  switch (event.type) {
    case "post_call_audio":
      return null;
    case "call_initiation_failure": {
      const reason = event.data.failure_reason;
      return {
        provider_conversation_id: event.data.conversation_id,
        outcome: reason === "busy" || reason === "no-answer" ? "no_answer" : "failed",
        transcript: [],
        call_successful: null,
        identity_confirmed: null,
        duration_secs: 0,
        cost_usd: 0,
        failure_reason: reason ?? null,
      };
    }
    case "post_call_transcription":
      return finishedToResult(event.data, event.data.metadata?.cost_fiat ?? 0);
  }
}

/** Map a GET /v1/convai/conversations/:id body to a result. */
function conversationToResult(data: ConversationData): CallResult {
  return finishedToResult(data, data.metadata?.cost_fiat ?? 0);
}

export function elevenLabsFetchCallResult(cfg: ElevenLabsConfig): FetchCallResult {
  return async (id) => {
    const res = await doFetch(cfg)(`${ELEVENLABS_API}/v1/convai/conversations/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { "xi-api-key": cfg.apiKey },
    });
    if (res.status === 404) return null;
    const text = await res.text();
    if (!res.ok) throw new Error(`elevenlabs get conversation failed: ${String(res.status)} ${text}`);
    const data = PostCallWebhook.shape.data.parse(JSON.parse(text));
    if (data.status !== "done" && data.status !== "failed") return null;
    return conversationToResult(data);
  };
}
