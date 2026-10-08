/**
 * Logout handler: deletes the session row and clears the cookie.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/auth/logout/handler.ts
 * Deps:    src/domain/session, src/app/api/_lib/*
 * Tested:  src/app/api/auth/__tests__/auth.test.ts
 *
 * Key responsibilities:
 * - Same-origin check, session delete, clearing Set-Cookie
 *
 * Design constraints:
 * - Always 204 once the origin check passes, even without a cookie
 */
import { clearSessionCookie, hashSessionToken, readSessionCookie } from "@/domain/session";
import { deleteSessionByHash, type AuthEnv } from "../../_lib/auth-store";
import { rejectCrossOrigin } from "../../_lib/same-origin";
import { isHttps } from "../../_lib/session";

export async function handleLogout(request: Request, env: AuthEnv): Promise<Response> {
  const denied = rejectCrossOrigin(request);
  if (denied !== null) return denied;
  const token = readSessionCookie(request.headers.get("Cookie"));
  if (token !== null) await deleteSessionByHash(env.DB, await hashSessionToken(token));
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie({ secure: isHttps(request) }) },
  });
}
