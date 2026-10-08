/**
 * Login handler: verifies the password and opens a session.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/auth/login/handler.ts
 * Deps:    src/domain/password, src/domain/session, src/app/api/_lib/*
 * Tested:  src/app/api/auth/__tests__/auth.test.ts
 *
 * Key responsibilities:
 * - Same-origin check, validation, failure rate limit, equal-timing verify, session cookie
 *
 * Design constraints:
 * - Unknown email and wrong password give the same 401; never log credentials
 */
import { LOGIN_FAILS_PER_WINDOW, LOGIN_WINDOW_MS, since } from "@/domain/auth-limits";
import { hashPassword, verifyPassword } from "@/domain/password";
import { hashSessionToken, newSessionToken, sessionCookie, sessionExpiresAt } from "@/domain/session";
import { LoginBody } from "../../_lib/auth-body";
import { countAttempts, findAccountByEmail, insertSession, recordAttempt, type AuthEnv } from "../../_lib/auth-store";
import { parseJsonBody } from "../../_lib/body";
import { isSameOriginBrowserRequest } from "../../_lib/same-origin";
import { isHttps, jsonWithCookie } from "../../_lib/session";

export async function handleLogin(request: Request, env: AuthEnv, now = new Date()): Promise<Response> {
  if (!isSameOriginBrowserRequest(request)) return Response.json({ error: "browser only" }, { status: 403 });
  const parsed = await parseJsonBody(request, LoginBody);
  if (parsed.error !== null) return parsed.error;
  const { email, password } = parsed.data;

  if ((await countAttempts(env.DB, "login_fail", email, since(now, LOGIN_WINDOW_MS))) >= LOGIN_FAILS_PER_WINDOW) {
    return Response.json({ error: "too many attempts" }, { status: 429 });
  }
  const account = await findAccountByEmail(env.DB, email);
  const ok = account !== null ? await verifyPassword(password, account.password_hash) : (await hashPassword(password), false);
  if (account === null || !ok) {
    await recordAttempt(env.DB, "login_fail", email, now.toISOString());
    return Response.json({ error: "email or password is wrong" }, { status: 401 });
  }

  const token = newSessionToken();
  await insertSession(env.DB, {
    id: crypto.randomUUID(),
    tokenHash: await hashSessionToken(token),
    accountId: account.id,
    now: now.toISOString(),
    expiresAt: sessionExpiresAt(now),
  });
  return jsonWithCookie({ ok: true }, 200, sessionCookie(token, { secure: isHttps(request) }));
}
