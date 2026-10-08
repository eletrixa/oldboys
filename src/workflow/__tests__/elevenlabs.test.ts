/**
 * Tests for the ElevenLabs adapter: request shape, response mapping and webhook mapping.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/elevenlabs.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - A fake fetchImpl captures the outgoing request and returns canned Responses
 * - Place-call, fetch-result and webhookToResult for all three event types
 *
 * Design constraints:
 * - No network; fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import type { CallBrief } from "@/domain/call";
import {
  dataCollectionBoolean,
  ELEVENLABS_API,
  elevenLabsFetchCallResult,
  elevenLabsPlaceCall,
  parsePostCallWebhook,
  webhookToResult,
} from "@/workflow/providers/elevenlabs";

type Captured = { url: string; method: string; headers: Record<string, string>; body: unknown };

function fake(res: () => Response): { fetchImpl: typeof fetch; seen: Captured[] } {
  const seen: Captured[] = [];
  const fetchImpl = (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    seen.push({
      url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      method: init?.method ?? "GET",
      headers: init?.headers as Record<string, string>,
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
    });
    return Promise.resolve(res());
  };
  return { fetchImpl, seen };
}

function first(seen: Captured[]): Captured {
  const req = seen[0];
  if (req === undefined) throw new Error("no request captured");
  return req;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const brief: CallBrief = {
  language: "cs",
  identity_question: "Mluvím s Janou Novákovou?",
  questions: [],
  script: "Dobrý den, jsem automatický AI asistent.\nPotřebuji ověřit jednu věc.",
};

const base = { apiKey: "k", agentId: "agent_1", phoneNumberId: "phnum_1" };

describe("elevenLabsPlaceCall", () => {
  it("sends the outbound-call request and maps the conversation id", async () => {
    const { fetchImpl, seen } = fake(() => json({ success: true, conversation_id: "conv_1", callSid: "CA1" }));
    const out = await elevenLabsPlaceCall({ ...base, fetchImpl })({ callId: "call-1", toNumber: "+420123456789", brief });
    expect(out).toEqual({ provider_conversation_id: "conv_1", result: null });
    expect(seen).toHaveLength(1);
    const req = first(seen);
    expect(req.url).toBe(`${ELEVENLABS_API}/v1/convai/twilio/outbound-call`);
    expect(req.method).toBe("POST");
    expect(req.headers["xi-api-key"]).toBe("k");
    expect(req.headers["Content-Type"]).toBe("application/json");
    expect(req.body).toEqual({
      agent_id: "agent_1",
      agent_phone_number_id: "phnum_1",
      to_number: "+420123456789",
      conversation_initiation_client_data: {
        dynamic_variables: { call_id: "call-1", subject_language: "cs" },
        conversation_config_override: {
          agent: {
            prompt: { prompt: brief.script },
            first_message: "Dobrý den, jsem automatický AI asistent.",
            language: "cs",
          },
        },
      },
    });
  });

  it("overrides prompt and first message with the brief's agent_prompt and first_message", async () => {
    const { fetchImpl, seen } = fake(() => json({ success: true, conversation_id: "conv_2" }));
    const full: CallBrief = { ...brief, language: "en", agent_prompt: "# Role\nYou are an AI.", first_message: "Hello, this is an automated AI assistant." };
    await elevenLabsPlaceCall({ ...base, fetchImpl })({ callId: "call-2", toNumber: "+420123456789", brief: full });
    const body = first(seen).body as { conversation_initiation_client_data: { conversation_config_override: { agent: unknown } } };
    expect(body.conversation_initiation_client_data.conversation_config_override.agent).toEqual({
      prompt: { prompt: "# Role\nYou are an AI." },
      first_message: "Hello, this is an automated AI assistant.",
      language: "en",
    });
  });

  it("throws with the status on a non-2xx response", async () => {
    const { fetchImpl } = fake(() => new Response("bad number", { status: 422 }));
    await expect(
      elevenLabsPlaceCall({ ...base, fetchImpl })({ callId: "c", toNumber: "+1", brief }),
    ).rejects.toThrow("elevenlabs outbound-call failed: 422 bad number");
  });

  it("throws when conversation_id is null", async () => {
    const { fetchImpl } = fake(() => json({ success: false, conversation_id: null, message: "no" }));
    await expect(
      elevenLabsPlaceCall({ ...base, fetchImpl })({ callId: "c", toNumber: "+1", brief }),
    ).rejects.toThrow(/elevenlabs outbound-call failed: 200/);
  });
});

describe("elevenLabsFetchCallResult", () => {
  const conversation = {
    conversation_id: "conv_1",
    status: "done",
    transcript: [
      { role: "agent", message: "Dobrý den", time_in_call_secs: 0 },
      { role: "user", message: null, time_in_call_secs: null },
    ],
    metadata: { call_duration_secs: 42, cost: 900, cost_fiat: 0.12 },
    analysis: { call_successful: "success", data_collection_results: { identity_confirmed: true } },
  };

  it("returns null on 404", async () => {
    const { fetchImpl, seen } = fake(() => new Response("nope", { status: 404 }));
    expect(await elevenLabsFetchCallResult({ ...base, fetchImpl })("conv_1")).toBeNull();
    expect(first(seen).url).toBe(`${ELEVENLABS_API}/v1/convai/conversations/conv_1`);
    expect(first(seen).method).toBe("GET");
    expect(first(seen).headers["xi-api-key"]).toBe("k");
  });

  it("returns null while in progress", async () => {
    const { fetchImpl } = fake(() => json({ ...conversation, status: "in-progress" }));
    expect(await elevenLabsFetchCallResult({ ...base, fetchImpl })("conv_1")).toBeNull();
  });

  it("maps a finished conversation, using cost_fiat as USD", async () => {
    const { fetchImpl } = fake(() => json(conversation));
    expect(await elevenLabsFetchCallResult({ ...base, fetchImpl })("conv_1")).toEqual({
      provider_conversation_id: "conv_1",
      outcome: "done",
      transcript: [
        { role: "agent", message: "Dobrý den", time_in_call_secs: 0 },
        { role: "user", message: "", time_in_call_secs: 0 },
      ],
      call_successful: true,
      identity_confirmed: true,
      duration_secs: 42,
      cost_usd: 0.12,
      failure_reason: null,
    });
  });

  it("maps status failed to outcome failed", async () => {
    const { fetchImpl } = fake(() => json({ ...conversation, status: "failed" }));
    expect((await elevenLabsFetchCallResult({ ...base, fetchImpl })("conv_1"))?.outcome).toBe("failed");
  });
});

describe("webhookToResult", () => {
  it("ignores post_call_audio", () => {
    const event = parsePostCallWebhook({ type: "post_call_audio", data: { conversation_id: "c", full_audio: "AAAA" } });
    expect(webhookToResult(event)).toBeNull();
  });

  it("maps busy to no_answer", () => {
    const event = parsePostCallWebhook({
      type: "call_initiation_failure",
      data: { conversation_id: "c", failure_reason: "busy" },
    });
    expect(webhookToResult(event)).toEqual({
      provider_conversation_id: "c",
      outcome: "no_answer",
      transcript: [],
      call_successful: null,
      identity_confirmed: null,
      duration_secs: 0,
      cost_usd: 0,
      failure_reason: "busy",
    });
  });

  it("maps other initiation failures to failed", () => {
    const event = parsePostCallWebhook({
      type: "call_initiation_failure",
      data: { conversation_id: "c", failure_reason: "unknown" },
    });
    expect(webhookToResult(event)?.outcome).toBe("failed");
  });

  it("maps a transcription event and stores cost 0", () => {
    const event = parsePostCallWebhook({
      type: "post_call_transcription",
      event_timestamp: 1,
      data: {
        conversation_id: "c",
        status: "done",
        transcript: [{ role: "user", message: "Ano", time_in_call_secs: 3 }],
        metadata: { call_duration_secs: 20, cost: 500 },
        analysis: { call_successful: "failure", data_collection_results: { identity_confirmed: "yes" } },
      },
    });
    expect(webhookToResult(event)).toEqual({
      provider_conversation_id: "c",
      outcome: "done",
      transcript: [{ role: "user", message: "Ano", time_in_call_secs: 3 }],
      call_successful: false,
      identity_confirmed: null,
      duration_secs: 20,
      cost_usd: 0,
      failure_reason: null,
    });
  });

  it("maps status failed and unknown verdict", () => {
    const event = parsePostCallWebhook({
      type: "post_call_transcription",
      data: { conversation_id: "c", status: "failed", analysis: { call_successful: "unknown" } },
    });
    const result = webhookToResult(event);
    expect(result?.outcome).toBe("failed");
    expect(result?.call_successful).toBeNull();
  });
});

describe("dataCollectionBoolean", () => {
  it("reads the ElevenLabs object form with a boolean or a true/false string", () => {
    expect(dataCollectionBoolean({ data_collection_id: "identity_confirmed", value: true, rationale: "said yes" })).toBe(true);
    expect(dataCollectionBoolean({ data_collection_id: "identity_confirmed", value: "false", rationale: "" })).toBe(false);
    expect(dataCollectionBoolean({ value: " True " })).toBe(true);
  });

  it("accepts a bare boolean and maps anything else to null", () => {
    expect(dataCollectionBoolean(false)).toBe(false);
    expect(dataCollectionBoolean("yes")).toBeNull();
    expect(dataCollectionBoolean({ value: null })).toBeNull();
    expect(dataCollectionBoolean(undefined)).toBeNull();
  });

  it("is used for identity_confirmed in a transcription webhook", () => {
    const event = parsePostCallWebhook({
      type: "post_call_transcription",
      data: {
        conversation_id: "c",
        status: "done",
        analysis: { data_collection_results: { identity_confirmed: { data_collection_id: "identity_confirmed", value: true, rationale: "x" } } },
      },
    });
    expect(webhookToResult(event)?.identity_confirmed).toBe(true);
  });
});

describe("parsePostCallWebhook", () => {
  it("rejects junk", () => {
    expect(() => parsePostCallWebhook(null)).toThrow();
    expect(() => parsePostCallWebhook({ type: "other", data: { conversation_id: "c" } })).toThrow();
    expect(() => parsePostCallWebhook({ type: "post_call_audio", data: {} })).toThrow();
  });
});
