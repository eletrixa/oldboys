/**
 * POST /api/start: the start form's entry point; attaches RUN_TOKEN server-side and delegates to POST /api/runs.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/start/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), src/app/api/runs/route (POST)
 * Tested:  n/a (thin wrapper; body validation and caps live in /api/runs)
 *
 * Key responsibilities:
 * - Keep RUN_TOKEN out of the browser bundle: the page posts here without credentials, the Worker adds the bearer
 * - Same hourly cap and validation as /api/runs; nothing else
 *
 * Design constraints:
 * - Only the start form uses this; CLI, extension and curl keep calling /api/runs with their own bearer
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { POST as createRun } from "@/app/api/runs/route";

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const token = env.RUN_TOKEN;
  if (token.length === 0) {
    return Response.json({ error: "RUN_TOKEN secret is not configured" }, { status: 503 });
  }
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return createRun(new Request(request.url, { method: "POST", headers, body: await request.text() }));
}
