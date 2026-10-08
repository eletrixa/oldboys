/**
 * POST /api/start: the signed-in recruiter's entry point for a new run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/start/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), src/app/api/_lib/{same-origin,session}, src/app/api/runs/handler
 * Tested:  n/a (thin wrapper; behaviour covered by src/app/api/runs/__tests__/handler.test.ts)
 *
 * Key responsibilities:
 * - Same-origin browser check (403), then session cookie (401 when missing or expired)
 * - Calls createRun in-process with via = start and the session's account and organization ids
 *
 * Design constraints:
 * - No RUN_TOKEN and no header rewriting; CLI, extension and curl keep calling /api/runs with their own bearer
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isSameOriginBrowserRequest } from "@/app/api/_lib/same-origin";
import { getSessionFromCookieHeader, unauthorized } from "@/app/api/_lib/session";
import { createRun } from "@/app/api/runs/handler";

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  if (!isSameOriginBrowserRequest(request)) return Response.json({ error: "browser only" }, { status: 403 });
  const user = await getSessionFromCookieHeader(env.DB, request.headers.get("Cookie"), new Date());
  if (user === null) return unauthorized();
  return createRun(request, env, { via: "start", accountId: user.accountId, organizationId: user.organizationId });
}
