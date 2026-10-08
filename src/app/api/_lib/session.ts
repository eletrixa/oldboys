/**
 * Next-free session lookup and response helpers.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/session.ts
 * Deps:    src/app/api/_lib/auth-store, src/domain/session
 * Tested:  src/app/api/auth/__tests__/auth.test.ts
 *
 * Key responsibilities:
 * - loadSession, cookie-header and request lookup, 401 and cookie-setting JSON responses
 * - startSession: mint a token, store its hash, answer with the session cookie
 *
 * Design constraints:
 * - No next/headers import; current-user.ts is the only Next-bound auth file
 */
import {
  hashSessionToken,
  newSessionToken,
  readSessionCookie,
  sessionCookie,
  sessionExpiresAt,
  type SessionUser,
} from "@/domain/session";
import { findSessionUser, insertSession } from "./auth-store";

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

export function sessionFromRequest(request: Request, db: D1Database, now = new Date()): Promise<SessionUser | null> {
  return getSessionFromCookieHeader(db, request.headers.get("Cookie"), now);
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

export async function startSession(
  db: D1Database,
  request: Request,
  accountId: string,
  now: Date,
  status: number,
): Promise<Response> {
  const token = newSessionToken();
  await insertSession(db, {
    id: crypto.randomUUID(),
    tokenHash: await hashSessionToken(token),
    accountId,
    now: now.toISOString(),
    expiresAt: sessionExpiresAt(now),
  });
  return jsonWithCookie({ ok: true }, status, sessionCookie(token, { secure: isHttps(request) }));
}
