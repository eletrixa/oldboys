/**
 * Tests for requireSessionOrBearer with a one-query fake D1.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/__tests__/session-or-bearer.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover valid and expired session, bearer, wrong bearer, unset secret and an anonymous request
 *
 * Design constraints:
 * - No module mocks; the fake answers only the session lookup
 */
import { describe, expect, it } from "vitest";
import { hashSessionToken, newSessionToken } from "@/domain/session";
import { requireSessionOrBearer } from "../session-or-bearer";

const NOW = new Date().toISOString();

async function setup(expiresAt: string) {
  const token = newSessionToken();
  const hash = await hashSessionToken(token);
  const row = {
    session_id: "s1", account_id: "a1", email: "j@x.test", name: "J", organization_id: "o1", organization_name: "Acme",
  };
  const DB = {
    prepare: (sql: string) => {
      if (!sql.startsWith("SELECT s.id AS session_id")) throw new Error(`unexpected SQL: ${sql}`);
      return { bind: (h: string, now: string) => ({ first: () => Promise.resolve(h === hash && expiresAt > now ? row : null) }) };
    },
  } as unknown as D1Database;
  return { token, DB };
}

const req = (headers: Record<string, string>) => new Request("http://x/api/positions", { headers });

describe("requireSessionOrBearer", () => {
  it("accepts a valid session cookie without any bearer", async () => {
    const { token, DB } = await setup("9999-01-01T00:00:00.000Z");
    expect(await requireSessionOrBearer(req({ Cookie: `oldboys_session=${token}` }), { DB })).toBeNull();
  });

  it("rejects an expired session as 401 login required", async () => {
    const { token, DB } = await setup("2000-01-01T00:00:00.000Z");
    const res = await requireSessionOrBearer(req({ Cookie: `oldboys_session=${token}` }), { DB, RUN_TOKEN: "secret" });
    expect(res?.status).toBe(401);
    expect(await res?.json()).toEqual({ error: "login required" });
  });

  it("accepts the right bearer and rejects a wrong one", async () => {
    const { DB } = await setup(NOW);
    expect(await requireSessionOrBearer(req({ Authorization: "Bearer secret" }), { DB, RUN_TOKEN: "secret" })).toBeNull();
    expect((await requireSessionOrBearer(req({ Authorization: "Bearer nope" }), { DB, RUN_TOKEN: "secret" }))?.status).toBe(401);
  });

  it("answers 503 for a bearer when RUN_TOKEN is unset, and 401 for an anonymous request", async () => {
    const { DB } = await setup(NOW);
    expect((await requireSessionOrBearer(req({ Authorization: "Bearer x" }), { DB }))?.status).toBe(503);
    expect((await requireSessionOrBearer(req({}), { DB }))?.status).toBe(401);
  });
});
