/**
 * POST /api/runs/:id/speech: "Read aloud" audio in the call agent's ElevenLabs voice; logic lives in handler.ts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/speech/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), ./handler, binding DB, secrets ELEVENLABS_API_KEY + RUN_TOKEN
 * Tested:  src/app/api/runs/[id]/speech/__tests__/handler.test.ts (via handler.ts)
 *
 * Key responsibilities:
 * - Pass the request, the run id and the Cloudflare bindings to speechRoute
 *
 * Design constraints:
 * - No runtime = "edge"; no logic here
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { speechRoute } from "./handler";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return speechRoute(request, getCloudflareContext().env, id);
}
