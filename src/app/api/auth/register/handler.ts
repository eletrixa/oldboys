/**
 * Register handler: creates organization, account and session.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/auth/register/handler.ts
 * Deps:    src/domain/password, src/domain/session, src/app/api/_lib/*
 * Tested:  src/app/api/auth/__tests__/auth.test.ts
 *
 * Key responsibilities:
 * - Same-origin check, validation, per-IP rate limit (counts every validated attempt, 409 included), account creation, session cookie
 *
 * Design constraints:
 * - Never log credentials; existing email is 409
 */
import { clientIp, HOUR_MS, REGISTER_PER_HOUR_PER_IP, since } from "@/domain/auth-limits";
import { hashPassword } from "@/domain/password";
import { hashSessionToken, newSessionToken, sessionCookie, sessionExpiresAt } from "@/domain/session";
import { RegisterBody } from "../../_lib/auth-body";
import {
  countAttempts,
  createAccountWithOrganization,
  findAccountByEmail,
  insertSession,
  recordAttempt,
  type AuthEnv,
} from "../../_lib/auth-store";
import { parseJsonBody } from "../../_lib/body";
import { isSameOriginBrowserRequest } from "../../_lib/same-origin";
import { isHttps, jsonWithCookie } from "../../_lib/session";

export async function handleRegister(request: Request, env: AuthEnv, now = new Date()): Promise<Response> {
  if (!isSameOriginBrowserRequest(request)) return Response.json({ error: "browser only" }, { status: 403 });
  const parsed = await parseJsonBody(request, RegisterBody);
  if (parsed.error !== null) return parsed.error;
  const body = parsed.data;

  const ip = clientIp(request.headers);
  if ((await countAttempts(env.DB, "register", ip, since(now, HOUR_MS))) >= REGISTER_PER_HOUR_PER_IP) {
    return Response.json({ error: "too many registrations" }, { status: 429 });
  }
  // Every validated attempt counts, including 409s, so the duplicate check cannot enumerate emails unthrottled.
  await recordAttempt(env.DB, "register", ip, now.toISOString());
  if ((await findAccountByEmail(env.DB, body.email)) !== null) {
    return Response.json({ error: "account exists" }, { status: 409 });
  }

  const accountId = crypto.randomUUID();
  try {
    await createAccountWithOrganization(env.DB, {
      accountId,
      email: body.email,
      name: body.name,
      passwordHash: await hashPassword(body.password),
      organizationId: crypto.randomUUID(),
      organization: body.organization,
      now: now.toISOString(),
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("UNIQUE")) {
      return Response.json({ error: "account exists" }, { status: 409 });
    }
    throw e;
  }

  const token = newSessionToken();
  await insertSession(env.DB, {
    id: crypto.randomUUID(),
    tokenHash: await hashSessionToken(token),
    accountId,
    now: now.toISOString(),
    expiresAt: sessionExpiresAt(now),
  });
  return jsonWithCookie({ ok: true }, 201, sessionCookie(token, { secure: isHttps(request) }));
}
