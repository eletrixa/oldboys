/**
 * POST /api/webhooks/elevenlabs: ElevenLabs post-call webhook entry point.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/webhooks/elevenlabs/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext)
 * Tested:  src/app/api/webhooks/__tests__/elevenlabs.test.ts (via handler.ts)
 *
 * Key responsibilities:
 * - Pass the request and Cloudflare bindings to handleElevenLabsWebhook
 *
 * Design constraints:
 * - No runtime = "edge"; all logic lives in handler.ts
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleElevenLabsWebhook } from "./handler";

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  return handleElevenLabsWebhook(request, env);
}
