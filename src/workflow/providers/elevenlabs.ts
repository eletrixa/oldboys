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

function doFetch(cfg: ElevenLabsConfig): typeof fetch {
  return cfg.fetchImpl ?? ((input, init) => fetch(input, init));
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
              prompt: { prompt: brief.script },
              first_message: brief.script.split("\n")[0],
              language: brief.language,
            },
          },
        },
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`elevenlabs outbound-call failed: ${String(res.status)} ${text}`);
    let conversationId: string | null | undefined;
    try {
      conversationId = OutboundResponse.parse(JSON.parse(text)).conversation_id;
    } catch {
      throw new Error(`elevenlabs outbound-call failed: ${String(res.status)} ${text}`);
    }
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
      metadata: z
        .object({ call_duration_secs: z.number().optional(), cost: z.number().optional() })
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

/** Shared mapping for a finished conversation (webhook `data` and GET body have the same fields). */
function finishedToResult(data: ConversationData, costUsd: number): CallResult {
  const dataCollection = data.analysis?.data_collection_results ?? {};
  const identity = dataCollection.identity_confirmed;
  const verdict = data.analysis?.call_successful;
  return {
    provider_conversation_id: data.conversation_id,
    outcome: data.status === "failed" ? "failed" : "done",
    transcript: (data.transcript ?? []).map((turn) => ({
      role: turn.role,
      message: turn.message ?? "",
      time_in_call_secs: turn.time_in_call_secs ?? 0,
    })),
    data_collection: dataCollection,
    call_successful: verdict === "success" ? true : verdict === "failure" ? false : null,
    identity_confirmed: typeof identity === "boolean" ? identity : null,
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
        data_collection: {},
        call_successful: null,
        identity_confirmed: null,
        duration_secs: 0,
        cost_usd: 0,
        failure_reason: reason ?? null,
      };
    }
    case "post_call_transcription":
      // metadata.cost has UNCONFIRMED units (credits, not USD), so webhooks store 0.
      // The GET conversation body gives metadata.cost_fiat (USD) when available.
      return finishedToResult(event.data, 0);
  }
}

const Conversation = PostCallWebhook.shape.data.extend({
  metadata: z
    .object({
      call_duration_secs: z.number().optional(),
      cost: z.number().optional(),
      cost_fiat: z.number().nullish(),
    })
    .loose()
    .optional(),
});

/** Map a GET /v1/convai/conversations/:id body to a result. */
export function conversationToResult(json: unknown): CallResult {
  const data = Conversation.parse(json);
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
    const json: unknown = JSON.parse(text);
    const status = z.object({ status: z.string().optional() }).parse(json).status;
    if (status !== "done" && status !== "failed") return null;
    return conversationToResult(json);
  };
}
