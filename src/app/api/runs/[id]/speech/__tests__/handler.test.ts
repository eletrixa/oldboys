/**
 * Tests for POST /api/runs/:id/speech: auth, body validation and the ElevenLabs call.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/speech/__tests__/handler.test.ts
 * Deps:    vitest, ../handler
 * Tested:  n/a
 *
 * Key responsibilities:
 * - No auth 401; unknown run 404; bad body 400; no key 503; ElevenLabs error 502; success streams audio/mpeg
 * - The upstream call uses the call agent's voice, the flash v2.5 model and the brief's language
 */
import { describe, expect, it, vi } from "vitest";
import { SPEECH_MODEL_ID, SPEECH_VOICE_ID, type SpeechEnv, speechRoute } from "../handler";

const DB = {
  prepare: (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: () => {
        if (sql.startsWith("SELECT id, organization_id FROM investigations")) {
          return Promise.resolve(args[0] === "run-1" ? { id: "run-1", organization_id: "org-1" } : null);
        }
        return Promise.resolve(null);
      },
    }),
  }),
} as unknown as D1Database;

const env = (over: Partial<SpeechEnv> = {}): SpeechEnv => ({ DB, RUN_TOKEN: "secret", ELEVENLABS_API_KEY: "el-key", ...over });

const req = (body: unknown, auth = true): Request =>
  new Request("https://oldboys.test/api/runs/run-1/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer secret" } : {}) },
    body: JSON.stringify(body),
  });

const audio = () => vi.fn<typeof fetch>(() => Promise.resolve(new Response("mp3-bytes", { status: 200 })));

describe("speechRoute", () => {
  it("answers 401 without a session or bearer", async () => {
    const res = await speechRoute(req({ text: "Hi", lang: "en" }, false), env(), "run-1", audio());
    expect(res.status).toBe(401);
  });

  it("answers 404 for an unknown run", async () => {
    const res = await speechRoute(req({ text: "Hi", lang: "en" }), env(), "run-x", audio());
    expect(res.status).toBe(404);
  });

  it("answers 400 for an empty text or an unknown language", async () => {
    expect((await speechRoute(req({ text: " ", lang: "en" }), env(), "run-1", audio())).status).toBe(400);
    expect((await speechRoute(req({ text: "Hi", lang: "de" }), env(), "run-1", audio())).status).toBe(400);
  });

  it("answers 503 without an ElevenLabs key and never calls out", async () => {
    const fetchFn = audio();
    const res = await speechRoute(req({ text: "Hi", lang: "en" }), env({ ELEVENLABS_API_KEY: "" }), "run-1", fetchFn);
    expect(res.status).toBe(503);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("answers 502 when ElevenLabs refuses", async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response("quota", { status: 401 })));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const res = await speechRoute(req({ text: "Hi", lang: "en" }), env(), "run-1", fetchFn);
    expect(res.status).toBe(502);
    warn.mockRestore();
  });

  it("streams the audio in the call agent's voice and the brief's language", async () => {
    const fetchFn = audio();
    const res = await speechRoute(req({ text: "Ověřeno: C#.", lang: "cs" }), env(), "run-1", fetchFn);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.text()).toBe("mp3-bytes");
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/v1/text-to-speech/${SPEECH_VOICE_ID}`);
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("el-key");
    expect(JSON.parse(init.body as string)).toMatchObject({ text: "Ověřeno: C#.", model_id: SPEECH_MODEL_ID, language_code: "cs" });
  });
});
