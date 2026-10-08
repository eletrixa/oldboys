/**
 * Next-free session lookup and response helpers.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/session.ts
 * Deps:    src/app/api/_lib/auth-store, src/domain/session
 * Tested:  src/app/api/auth/__tests__/auth.test.ts
 *
 * Key responsibilities:
 * - loadSession, cookie-header lookup, 401 and cookie-setting JSON responses
 *
 * Design constraints:
 * - No next/headers import; current-user.ts is the only Next-bound auth file
 */
import { hashSessionToken, readSessionCookie, type SessionUser } from "@/domain/session";
import { findSessionUser } from "./auth-store";

export async function loadSession(db: D1Database, token: string, now: Date): Promise<SessionUser | null> {
  return findSessionUser(db, await hashSessionToken(token), now.toISOString());
}

export async function getSessionFromCookieHeader(
  db: D1Database,
  cookieHeader: string | null,
  now: Date,
): Promise<SessionUser | null> {
  const token = readSessionCookie(cookieHeader);
  return token === null ? null : loadSession(db, token, now);
}

export function unauthorized(): Response {
  return Response.json({ error: "login required" }, { status: 401 });
}

export function jsonWithCookie(body: unknown, status: number, setCookie: string): Response {
  const res = Response.json(body, { status });
  res.headers.append("Set-Cookie", setCookie);
  return res;
}

export function isHttps(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}
