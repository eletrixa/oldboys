/**
 * Shared guard for team-shared routes: a valid session cookie or the bearer RUN_TOKEN.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/session-or-bearer.ts
 * Deps:    src/app/api/_lib/{auth,session}
 * Tested:  src/app/api/_lib/__tests__/session-or-bearer.test.ts
 *
 * Key responsibilities:
 * - requireSessionOrBearer: null when authorized, else an error Response
 *
 * Design constraints:
 * - Session first (browser pages); the bearer keeps curl and the extension working
 * - No Authorization header and no session: 401 "login required"; a presented bearer is judged by requireBearer (401 / 503)
 */
import { requireBearer } from "./auth";
import { sessionFromRequest, unauthorized } from "./session";

export async function requireSessionOrBearer(
  request: Request,
  env: { DB: D1Database; RUN_TOKEN?: string },
): Promise<Response | null> {
  if ((await sessionFromRequest(request, env.DB)) !== null) return null;
  if (!request.headers.has("Authorization")) return unauthorized();
  return requireBearer(request, env.RUN_TOKEN);
}
