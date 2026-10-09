/**
 * POST /api/runs/:id/speech logic: the "In 30 seconds" sentences as audio in the call agent's ElevenLabs voice.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/speech/handler.ts
 * Deps:    src/app/api/_lib/{run-access,body}, zod, binding DB, secrets ELEVENLABS_API_KEY + RUN_TOKEN
 * Tested:  src/app/api/runs/[id]/speech/__tests__/handler.test.ts
 *
 * Key responsibilities:
 * - Auth like POST /api/runs/:id/translate: a same-origin session user (of the run's organization) or the bearer;
 *   unknown run 404, another organization 403, so a public brief link cannot spend ElevenLabs credits
 * - Body `{ text, lang }` (Zod, 400): text 1..SPEECH_MAX_CHARS, lang "en" | "cs"
 * - One ElevenLabs text-to-speech call with SPEECH_VOICE_ID (the voice of the verification call agent) and
 *   eleven_flash_v2_5 (speaks Czech too); the MP3 is streamed back as audio/mpeg
 * - 503 without ELEVENLABS_API_KEY, 502 when ElevenLabs refuses (logged with the status, never the text);
 *   the client then falls back to the browser voice
 *
 * Design constraints:
 * - Nothing is stored or cached; only the summary sentences (counts, criteria, one question) go to ElevenLabs
 * - Takes bindings and fetch as parameters so tests run under plain Node; no Next.js imports; every response is no-store
 */
import { z } from "zod";
import { parseJsonBody } from "@/app/api/_lib/body";
import { authorizeRunAction, findRunOwner, otherOrganization } from "@/app/api/_lib/run-access";

/** Voice of the ElevenLabs agent that makes the verification calls (agent "oldboys verification call"). */
export const SPEECH_VOICE_ID = "cjVigY5qzO86Huf0OWal";
export const SPEECH_MODEL_ID = "eleven_flash_v2_5";
export const SPEECH_MAX_CHARS = 1500;

export const SpeechBody = z.object({
  text: z.string().trim().min(1).max(SPEECH_MAX_CHARS),
  lang: z.enum(["en", "cs"]),
});

export type SpeechEnv = { DB: D1Database; RUN_TOKEN?: string; ELEVENLABS_API_KEY?: string };

const json = (body: unknown, status: number): Response => Response.json(body, { status });

export async function speechRoute(request: Request, env: SpeechEnv, runId: string, fetchFn: typeof fetch = fetch): Promise<Response> {
  const res = await handle(request, env, runId, fetchFn);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function handle(request: Request, env: SpeechEnv, runId: string, fetchFn: typeof fetch): Promise<Response> {
  const { user, denied } = await authorizeRunAction(request, env);
  if (denied !== null) return denied;
  const run = await findRunOwner(env.DB, runId);
  if (run === null) return json({ error: "run not found" }, 404);
  if (otherOrganization(user, run)) return json({ error: "this run belongs to another organization" }, 403);

  const body = await parseJsonBody(request, SpeechBody);
  if (body.error !== null) return body.error;

  const key = env.ELEVENLABS_API_KEY;
  if (key === undefined || key === "") return json({ error: "ELEVENLABS_API_KEY is not configured" }, 503);

  const upstream = await fetchFn(`https://api.elevenlabs.io/v1/text-to-speech/${SPEECH_VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: body.data.text,
      model_id: SPEECH_MODEL_ID,
      language_code: body.data.lang,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, speed: 1.0 },
    }),
  });
  if (!upstream.ok || upstream.body === null) {
    console.warn("speech failed", { run: runId, status: upstream.status });
    return json({ error: "text to speech failed" }, 502);
  }
  return new Response(upstream.body, { status: 200, headers: { "Content-Type": "audio/mpeg" } });
}
