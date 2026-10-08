/**
 * Tests for register, login, logout and session loading with a hand-written fake D1.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/auth/__tests__/auth.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover cookie flags, same-origin gate, validation, duplicates, rate limits, equal-timing login, logout, expiry
 *
 * Design constraints:
 * - No module mocks; the fake matches on SQL prefixes and keeps state in plain maps
 */
import { describe, expect, it } from "vitest";
import { SESSION_TTL_MS } from "@/domain/session";
import { loadSession } from "../../_lib/session";
import type { AuthEnv } from "../../_lib/auth-store";
import { handleLogin } from "../login/handler";
import { handleLogout } from "../logout/handler";
import { handleRegister } from "../register/handler";

type Row = Record<string, unknown>;

function makeEnv() {
  const orgs = new Map<string, Row>();
  const accounts = new Map<string, Row>();
  const sessions = new Map<string, Row>();
  const attempts: Row[] = [];

  const exec = (sql: string, a: unknown[]): { rows: Row[]; changes: number } => {
    if (sql.startsWith("SELECT id, email, name, password_hash, organization_id FROM accounts")) {
      const r = [...accounts.values()].find((x) => x.email === a[0]);
      return { rows: r ? [r] : [], changes: 0 };
    }
    if (sql.startsWith("INSERT INTO organizations")) {
      orgs.set(a[0] as string, {
        id: a[0], name: a[1], ico: a[2], dic: a[3], legal_form: a[4], address: a[5], country: a[6], source: a[7],
      });
      return { rows: [], changes: 1 };
    }
    if (sql.startsWith("INSERT INTO accounts")) {
      if ([...accounts.values()].some((x) => x.email === a[1])) throw new Error("UNIQUE constraint failed: accounts.email");
      accounts.set(a[0] as string, {
        id: a[0], email: a[1], name: a[2], password_hash: a[3], organization_id: a[4],
      });
      return { rows: [], changes: 1 };
    }
    if (sql.startsWith("INSERT INTO sessions")) {
      sessions.set(a[0] as string, { id: a[0], token_hash: a[1], account_id: a[2], created_at: a[3], expires_at: a[4] });
      return { rows: [], changes: 1 };
    }
    if (sql.startsWith("SELECT s.id AS session_id")) {
      const s = [...sessions.values()].find((x) => x.token_hash === a[0] && (x.expires_at as string) > (a[1] as string));
      const acc = s ? accounts.get(s.account_id as string) : undefined;
      const org = acc ? orgs.get(acc.organization_id as string) : undefined;
      if (!s || !acc || !org) return { rows: [], changes: 0 };
      return {
        rows: [{
          session_id: s.id, account_id: acc.id, email: acc.email, name: acc.name,
          organization_id: org.id, organization_name: org.name,
        }],
        changes: 0,
      };
    }
    if (sql.startsWith("DELETE FROM sessions WHERE token_hash")) {
      for (const [id, s] of sessions) if (s.token_hash === a[0]) sessions.delete(id);
      return { rows: [], changes: 1 };
    }
    if (sql.startsWith("SELECT COUNT(*) AS n FROM auth_attempts")) {
      const n = attempts.filter((x) => x.kind === a[0] && x.subject === a[1] && (x.at as string) > (a[2] as string)).length;
      return { rows: [{ n }], changes: 0 };
    }
    if (sql.startsWith("INSERT INTO auth_attempts")) {
      attempts.push({ kind: a[0], subject: a[1], at: a[2] });
      return { rows: [], changes: 1 };
    }
    if (sql.startsWith("DELETE FROM auth_attempts")) return { rows: [], changes: 0 };
    throw new Error(`unexpected SQL: ${sql}`);
  };

  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...v: unknown[]) => stmt(sql, v),
    first: () => Promise.resolve(exec(sql, args).rows[0] ?? null),
    run: () => Promise.resolve({ meta: { changes: exec(sql, args).changes } }),
    all: () => Promise.resolve({ results: exec(sql, args).rows }),
    exec: () => exec(sql, args),
  });
  const db = {
    prepare: (sql: string) => stmt(sql),
    batch: (list: ReturnType<typeof stmt>[]) => Promise.resolve(list.map((s) => ({ results: s.exec().rows }))),
  };
  return { env: { DB: db } as unknown as AuthEnv, orgs, accounts, sessions, attempts };
}

function browserPost(path: string, body: unknown, cookie?: string, sameOrigin = true): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: "https://x.test",
    Host: "x.test",
    "CF-Connecting-IP": "1.2.3.4",
  };
  if (sameOrigin) headers["Sec-Fetch-Site"] = "same-origin";
  if (cookie !== undefined) headers.Cookie = cookie;
  return new Request(`https://x.test${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

const registerBody = {
  email: "Jane@Example.com",
  password: "correct horse",
  name: "Jane",
  organization: { name: "Acme s.r.o.", ico: "27074358", source: "ares" },
};
const NOW = new Date("2026-10-08T10:00:00.000Z");

async function registered() {
  const e = makeEnv();
  await handleRegister(browserPost("/api/auth/register", registerBody), e.env, NOW);
  return e;
}

describe("register", () => {
  it("creates the account, org and session and sets a hardened cookie", async () => {
    const e = makeEnv();
    const res = await handleRegister(browserPost("/api/auth/register", registerBody), e.env, NOW);
    expect(res.status).toBe(201);
    const cookie = res.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect([...e.accounts.values()][0]?.email).toBe("jane@example.com");
    expect([...e.orgs.values()][0]?.source).toBe("ares");
    expect(e.sessions.size).toBe(1);
  });

  it("rejects a request without Sec-Fetch-Site", async () => {
    const e = makeEnv();
    const res = await handleRegister(browserPost("/api/auth/register", registerBody, undefined, false), e.env, NOW);
    expect(res.status).toBe(403);
  });

  it("rejects an invalid body", async () => {
    const e = makeEnv();
    const res = await handleRegister(browserPost("/api/auth/register", { ...registerBody, password: "x" }), e.env, NOW);
    expect(res.status).toBe(400);
  });

  it("answers 409 for an existing email", async () => {
    const e = await registered();
    const res = await handleRegister(browserPost("/api/auth/register", registerBody), e.env, NOW);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "account exists" });
  });

  it("answers 429 on the 11th registration from one IP", async () => {
    const e = makeEnv();
    for (let i = 0; i < 10; i++) e.attempts.push({ kind: "register", subject: "1.2.3.4", at: NOW.toISOString() });
    const res = await handleRegister(browserPost("/api/auth/register", registerBody), e.env, NOW);
    expect(res.status).toBe(429);
  });
});

describe("login", () => {
  const login = { email: "jane@example.com", password: "correct horse" };

  it("opens a session for the right password", async () => {
    const e = await registered();
    e.sessions.clear();
    const res = await handleLogin(browserPost("/api/auth/login", login), e.env, NOW);
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("oldboys_session=");
    const s = [...e.sessions.values()][0];
    expect(s?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(s?.expires_at as string).getTime() - NOW.getTime()).toBe(SESSION_TTL_MS);
  });

  it("answers 401 and records an attempt for a wrong password", async () => {
    const e = await registered();
    const res = await handleLogin(browserPost("/api/auth/login", { ...login, password: "nope" }), e.env, NOW);
    expect(res.status).toBe(401);
    expect(e.attempts.some((a) => a.kind === "login_fail" && a.subject === "jane@example.com")).toBe(true);
  });

  it("gives an identical 401 body for an unknown email", async () => {
    const e = await registered();
    const wrong = await handleLogin(browserPost("/api/auth/login", { ...login, password: "nope" }), e.env, NOW);
    const unknown = await handleLogin(browserPost("/api/auth/login", { email: "who@example.com", password: "nope" }), e.env, NOW);
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());
  });

  it("answers 429 on the sixth failure without verifying", async () => {
    const e = await registered();
    for (let i = 0; i < 5; i++) e.attempts.push({ kind: "login_fail", subject: "jane@example.com", at: NOW.toISOString() });
    const res = await handleLogin(browserPost("/api/auth/login", login), e.env, NOW);
    expect(res.status).toBe(429);
    expect(e.sessions.size).toBe(1);
  });
});

describe("logout and session", () => {
  it("deletes the session row and clears the cookie", async () => {
    const e = makeEnv();
    const reg = await handleRegister(browserPost("/api/auth/register", registerBody), e.env, NOW);
    const cookie = (reg.headers.get("Set-Cookie") ?? "").split(";")[0] ?? "";
    const res = await handleLogout(browserPost("/api/auth/logout", {}, cookie), e.env);
    expect(res.status).toBe(204);
    expect(e.sessions.size).toBe(0);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("still answers 204 without a cookie", async () => {
    const e = makeEnv();
    const res = await handleLogout(browserPost("/api/auth/logout", {}), e.env);
    expect(res.status).toBe(204);
  });

  it("loads a live session and rejects an expired one", async () => {
    const e = makeEnv();
    const reg = await handleRegister(browserPost("/api/auth/register", registerBody), e.env, NOW);
    const token = (reg.headers.get("Set-Cookie") ?? "").split(";")[0]?.split("=")[1] ?? "";
    const user = await loadSession(e.env.DB, token, NOW);
    expect(user?.organizationName).toBe("Acme s.r.o.");
    const s = [...e.sessions.values()][0];
    if (s) s.expires_at = new Date(NOW.getTime() - 1000).toISOString();
    expect(await loadSession(e.env.DB, token, NOW)).toBeNull();
  });
});
