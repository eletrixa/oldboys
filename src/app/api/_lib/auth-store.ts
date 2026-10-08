/**
 * All D1 access for accounts, sessions and auth rate-limit counters.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/auth-store.ts
 * Deps:    D1, src/domain/session, src/domain/organization, src/domain/auth-limits
 * Tested:  src/app/api/auth/__tests__/auth.test.ts
 *
 * Key responsibilities:
 * - Raw SQL for the auth routes
 *
 * Design constraints:
 * - SQL prefixes are a contract: the test fake dispatches on them
 */
import { ATTEMPT_RETENTION_MS, type AttemptKind } from "@/domain/auth-limits";
import type { OrganizationInput } from "@/domain/organization";
import type { SessionUser } from "@/domain/session";

export type AuthEnv = { DB: D1Database };
export type AccountRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  organization_id: string;
};

export function findAccountByEmail(db: D1Database, email: string): Promise<AccountRow | null> {
  return db
    .prepare("SELECT id, email, name, password_hash, organization_id FROM accounts WHERE email = ?")
    .bind(email)
    .first<AccountRow>();
}

export async function createAccountWithOrganization(
  db: D1Database,
  input: {
    accountId: string;
    email: string;
    name: string;
    passwordHash: string;
    organizationId: string;
    organization: OrganizationInput;
    now: string;
  },
): Promise<void> {
  const o = input.organization;
  await db.batch([
    db
      .prepare(
        "INSERT INTO organizations (id, name, ico, dic, legal_form, address, country, source, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .bind(input.organizationId, o.name, o.ico, o.dic, o.legal_form, o.address, o.country, o.source, input.now),
    db
      .prepare(
        "INSERT INTO accounts (id, email, name, password_hash, organization_id, created_at) VALUES (?,?,?,?,?,?)",
      )
      .bind(input.accountId, input.email, input.name, input.passwordHash, input.organizationId, input.now),
  ]);
}

export async function insertSession(
  db: D1Database,
  input: { id: string; tokenHash: string; accountId: string; now: string; expiresAt: string },
): Promise<void> {
  await db
    .prepare("INSERT INTO sessions (id, token_hash, account_id, created_at, expires_at) VALUES (?,?,?,?,?)")
    .bind(input.id, input.tokenHash, input.accountId, input.now, input.expiresAt)
    .run();
}

type SessionJoinRow = {
  session_id: string;
  account_id: string;
  email: string;
  name: string;
  organization_id: string;
  organization_name: string;
};

export async function findSessionUser(
  db: D1Database,
  tokenHash: string,
  nowIso: string,
): Promise<SessionUser | null> {
  const r = await db
    .prepare(
      "SELECT s.id AS session_id, a.id AS account_id, a.email, a.name, o.id AS organization_id, o.name AS organization_name FROM sessions s JOIN accounts a ON a.id = s.account_id JOIN organizations o ON o.id = a.organization_id WHERE s.token_hash = ? AND s.expires_at > ?",
    )
    .bind(tokenHash, nowIso)
    .first<SessionJoinRow>();
  if (r === null) return null;
  return {
    sessionId: r.session_id,
    accountId: r.account_id,
    email: r.email,
    name: r.name,
    organizationId: r.organization_id,
    organizationName: r.organization_name,
  };
}

export async function deleteSessionByHash(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function countAttempts(
  db: D1Database,
  kind: AttemptKind,
  subject: string,
  sinceIso: string,
): Promise<number> {
  const r = await db
    .prepare("SELECT COUNT(*) AS n FROM auth_attempts WHERE kind = ? AND subject = ? AND at > ?")
    .bind(kind, subject, sinceIso)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

export async function recordAttempt(
  db: D1Database,
  kind: AttemptKind,
  subject: string,
  nowIso: string,
): Promise<void> {
  const cutoff = new Date(new Date(nowIso).getTime() - ATTEMPT_RETENTION_MS).toISOString();
  await db.batch([
    db.prepare("INSERT INTO auth_attempts (kind, subject, at) VALUES (?,?,?)").bind(kind, subject, nowIso),
    db.prepare("DELETE FROM auth_attempts WHERE at < ?").bind(cutoff),
  ]);
}
