/**
 * Login handler: verifies the password and opens a session.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/auth/login/handler.ts
 * Deps:    src/domain/password, src/domain/session, src/app/api/_lib/*
 * Tested:  src/app/api/auth/__tests__/auth.test.ts
 *
 * Key responsibilities:
 * - Same-origin check, validation, failure rate limit per email and IP, equal-timing verify, session cookie
 *
 * Design constraints:
 * - Unknown email and wrong password give the same 401; never log credentials
 */
import { clientIp, LOGIN_FAILS_PER_WINDOW, LOGIN_WINDOW_MS } from "@/domain/auth-limits";
import { hashPassword, verifyPassword } from "@/domain/password";
import { LoginBody } from "../../_lib/auth-body";
import { findAccountByEmail, recordAttempt, throttled, type AuthEnv } from "../../_lib/auth-store";
import { parseJsonBody } from "../../_lib/body";
import { rejectCrossOrigin } from "../../_lib/same-origin";
import { startSession } from "../../_lib/session";

export async function handleLogin(request: Request, env: AuthEnv, now = new Date()): Promise<Response> {
  const denied = rejectCrossOrigin(request);
  if (denied !== null) return denied;
  const parsed = await parseJsonBody(request, LoginBody);
  if (parsed.error !== null) return parsed.error;
  const { email, password } = parsed.data;

  // Keyed by email and IP so a stranger cannot lock a recruiter out from another address.
  const subject = `${email}|${clientIp(request.headers)}`;
  const [locked, account] = await Promise.all([
    throttled(env.DB, "login_fail", subject, LOGIN_WINDOW_MS, LOGIN_FAILS_PER_WINDOW, now),
    findAccountByEmail(env.DB, email),
  ]);
  if (locked) return Response.json({ error: "too many attempts" }, { status: 429 });
  const ok = account !== null ? await verifyPassword(password, account.password_hash) : (await hashPassword(password), false);
  if (account === null || !ok) {
    await recordAttempt(env.DB, "login_fail", subject, now.toISOString());
    return Response.json({ error: "email or password is wrong" }, { status: 401 });
  }

  return startSession(env.DB, request, account.id, now, 200);
}
