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
import { clientIp, HOUR_MS, REGISTER_PER_HOUR_PER_IP } from "@/domain/auth-limits";
import { hashPassword } from "@/domain/password";
import { RegisterBody } from "../../_lib/auth-body";
import {
  createAccountWithOrganization,
  findAccountByEmail,
  recordAttempt,
  throttled,
  type AuthEnv,
} from "../../_lib/auth-store";
import { parseJsonBody } from "../../_lib/body";
import { rejectCrossOrigin } from "../../_lib/same-origin";
import { startSession } from "../../_lib/session";

const accountExists = (): Response => Response.json({ error: "account exists" }, { status: 409 });

export async function handleRegister(request: Request, env: AuthEnv, now = new Date()): Promise<Response> {
  const denied = rejectCrossOrigin(request);
  if (denied !== null) return denied;
  const parsed = await parseJsonBody(request, RegisterBody);
  if (parsed.error !== null) return parsed.error;
  const body = parsed.data;

  const ip = clientIp(request.headers);
  if (await throttled(env.DB, "register", ip, HOUR_MS, REGISTER_PER_HOUR_PER_IP, now)) {
    return Response.json({ error: "too many registrations" }, { status: 429 });
  }
  // Every validated attempt counts, including 409s, so the duplicate check cannot enumerate emails unthrottled.
  const [, existing] = await Promise.all([
    recordAttempt(env.DB, "register", ip, now.toISOString()),
    findAccountByEmail(env.DB, body.email),
  ]);
  if (existing !== null) return accountExists();

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
    if (e instanceof Error && e.message.includes("UNIQUE")) return accountExists();
    throw e;
  }

  return startSession(env.DB, request, accountId, now, 201);
}
