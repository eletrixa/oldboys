/**
 * Tests for the ElevenLabs webhook handler using hand-written D1, R2 and Workflow fakes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/webhooks/__tests__/elevenlabs.test.ts
 * Deps:    vitest, node:crypto
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover secret/signature/body rejection, ignore paths, first delivery, duplicate, busy, sendEvent failure
 *
 * Design constraints:
 * - No module mocks; fakes match on SQL prefixes and keep state in plain maps
 */
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { handleElevenLabsWebhook, type WebhookEnv } from "../elevenlabs/handler";

const SECRET = "whsec_test";
const NOW = 1_800_000_000;

type CallRec = Record<string, unknown> & { id: string; run_id: string; status: string };

function makeEnv(opts: { secret?: string; sendEventError?: Error } = {}) {
  const calls = new Map<string, CallRec>();
  calls.set("conv_1", { id: "call_1", run_id: "run_1", status: "in_call" });
  const events = new Set<string>();
  const ledger: unknown[][] = [];
  const puts: string[] = [];
  const sendEvent = vi.fn((_: unknown) =>
    opts.sendEventError ? Promise.reject(opts.sendEventError) : Promise.resolve(),
  );

  const exec = (sql: string, args: unknown[]): unknown => {
    if (sql.startsWith("SELECT id, run_id, status FROM calls")) {
      const c = calls.get(args[0] as string);
      return c ? { id: c.id, run_id: c.run_id, status: c.status } : null;
    }
    if (sql.startsWith("SELECT 1 FROM webhook_events")) {
      return events.has(`${args[0] as string}|${args[1] as string}`) ? { "1": 1 } : null;
    }
    if (sql.startsWith("INSERT INTO webhook_events")) {
      events.add(`${args[0] as string}|${args[1] as string}`);
      return null;
    }
    if (sql.startsWith("UPDATE calls SET result_r2_key")) {
      const id = args[8] as string;
      const rec = [...calls.values()].find((c) => c.id === id);
      if (rec) {
        Object.assign(rec, {
          result_r2_key: args[0],
          status: args[1],
          call_successful: args[2],
          identity_confirmed: args[3],
          duration_secs: args[4],
          cost_usd: args[5],
          failure_reason: args[6],
          finished_at: args[7],
        });
      }
      return null;
    }
    if (sql.startsWith("UPDATE calls SET last_error")) {
      const rec = [...calls.values()].find((c) => c.id === args[1]);
      if (rec) rec.last_error = args[0];
      return null;
    }
    if (sql.startsWith("INSERT INTO ledger_entries")) {
      ledger.push(args);
      return { seq: ledger.length };
    }
    throw new Error(`unexpected SQL: ${sql}`);
  };

  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: () => Promise.resolve(exec(sql, args)),
    run: () => Promise.resolve(exec(sql, args)),
    all: () => Promise.resolve({ results: [] }),
    exec: () => exec(sql, args),
  });
  const db = {
    prepare: (sql: string) => stmt(sql),
    batch: (stmts: ReturnType<typeof stmt>[]) => Promise.resolve(stmts.map((s) => s.exec())),
  };
  const env = {
    DB: db,
    SOURCES: {
      put: (key: string) => {
        puts.push(key);
        return Promise.resolve();
      },
    },
    VERIFY_CALL: { get: () => Promise.resolve({ sendEvent }) },
    ELEVENLABS_WEBHOOK_SECRET: "secret" in opts ? opts.secret : SECRET,
  } as unknown as WebhookEnv;
  return { env, calls, events, puts, sendEvent, ledger };
}

function signed(body: string, secret = SECRET, t = NOW): Request {
  const v0 = createHmac("sha256", secret).update(`${String(t)}.${body}`).digest("hex");
  return new Request("https://x.test/api/webhooks/elevenlabs", {
    method: "POST",
    headers: { "ElevenLabs-Signature": `t=${String(t)},v0=${v0}` },
    body,
  });
}

const transcription = JSON.stringify({
  type: "post_call_transcription",
  data: {
    conversation_id: "conv_1",
    status: "done",
    transcript: [{ role: "agent", message: "Hello", time_in_call_secs: 1 }],
    metadata: { call_duration_secs: 42 },
    analysis: { call_successful: "success", data_collection_results: { identity_confirmed: true } },
  },
});

describe("handleElevenLabsWebhook", () => {
  it("503 without a secret", async () => {
    const { env } = makeEnv({ secret: "" });
    const res = await handleElevenLabsWebhook(signed(transcription), env, NOW);
    expect(res.status).toBe(503);
  });

  it("401 on a bad signature", async () => {
    const { env } = makeEnv();
    const res = await handleElevenLabsWebhook(signed(transcription, "wrong"), env, NOW);
    expect(res.status).toBe(401);
  });

  it("400 on junk JSON with a valid signature", async () => {
    const { env } = makeEnv();
    const res = await handleElevenLabsWebhook(signed("not json"), env, NOW);
    expect(res.status).toBe(400);
  });

  it("ignores post_call_audio", async () => {
    const { env, puts } = makeEnv();
    const body = JSON.stringify({ type: "post_call_audio", data: { conversation_id: "conv_1" } });
    const res = await handleElevenLabsWebhook(signed(body), env, NOW);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: true });
    expect(puts).toHaveLength(0);
  });

  it("500 for an unknown conversation so the provider retries", async () => {
    const { env } = makeEnv();
    const body = JSON.stringify({ type: "post_call_transcription", data: { conversation_id: "nope" } });
    const res = await handleElevenLabsWebhook(signed(body), env, NOW);
    expect(res.status).toBe(500);
  });

  it("first delivery stores the result, updates the call, records the event, wakes the Workflow", async () => {
    const { env, calls, events, puts, sendEvent, ledger } = makeEnv();
    const res = await handleElevenLabsWebhook(signed(transcription), env, NOW);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: "call_1", status: "done" });
    expect(puts).toEqual(["oldboys-sources/run_1/call-call_1.json"]);
    expect(calls.get("conv_1")).toMatchObject({
      status: "done",
      call_successful: 1,
      identity_confirmed: 1,
      duration_secs: 42,
      result_r2_key: "oldboys-sources/run_1/call-call_1.json",
    });
    expect(events.has("conv_1|post_call_transcription")).toBe(true);
    expect(ledger).toHaveLength(1);
    expect(sendEvent).toHaveBeenCalledWith({ type: "call-result", payload: { conversation_id: "conv_1" } });
  });

  it("duplicate delivery has no side effects", async () => {
    const { env, puts, sendEvent } = makeEnv();
    await handleElevenLabsWebhook(signed(transcription), env, NOW);
    const res = await handleElevenLabsWebhook(signed(transcription), env, NOW);
    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(puts).toHaveLength(1);
    expect(sendEvent).toHaveBeenCalledTimes(1);
  });

  it("call_initiation_failure busy maps to no_answer", async () => {
    const { env, calls } = makeEnv();
    const body = JSON.stringify({
      type: "call_initiation_failure",
      data: { conversation_id: "conv_1", failure_reason: "busy" },
    });
    const res = await handleElevenLabsWebhook(signed(body), env, NOW);
    expect(await res.json()).toMatchObject({ ok: true, status: "no_answer" });
    expect(calls.get("conv_1")?.status).toBe("no_answer");
  });

  it("a throwing sendEvent still returns 200 and records last_error", async () => {
    const { env, calls } = makeEnv({ sendEventError: new Error("instance not found") });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const res = await handleElevenLabsWebhook(signed(transcription), env, NOW);
    warn.mockRestore();
    expect(res.status).toBe(200);
    expect(calls.get("conv_1")?.last_error).toBe("instance not found");
  });

  it("an illegal transition is recorded as stale and leaves the call untouched", async () => {
    const { env, calls, events } = makeEnv();
    const rec = calls.get("conv_1");
    if (rec) rec.status = "done";
    const res = await handleElevenLabsWebhook(signed(transcription), env, NOW);
    expect(await res.json()).toEqual({ ok: true, stale: true });
    expect(calls.get("conv_1")?.status).toBe("done");
    expect(calls.get("conv_1")?.result_r2_key).toBeUndefined();
    expect(events.has("conv_1|post_call_transcription")).toBe(true);
  });
});
