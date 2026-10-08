/**
 * Tests for createRun with a hand-written D1 and a Workflow create spy.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/__tests__/handler.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover api vs start origin inserts, sourceUrl reuse, global and start caps, invalid body
 *
 * Design constraints:
 * - No module mocks; the fake D1 dispatches on SQL prefixes and keeps counts in plain variables
 */
import { describe, expect, it, vi } from "vitest";
import { RUNS_PER_HOUR_CAP, START_PER_HOUR_CAP } from "@/domain/run-status";
import { createRun, type RunOrigin, type RunsEnv } from "../handler";

const NOW = new Date("2026-10-08T12:00:00Z");

function makeEnv(opts: { recent?: number; recentStart?: number; earlier?: string } = {}) {
  const inserts: unknown[][] = [];
  const create = vi.fn((_: unknown) => Promise.resolve());
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: () => {
      if (sql.startsWith("SELECT id FROM investigations WHERE source_url")) {
        return Promise.resolve(opts.earlier === undefined ? null : { id: opts.earlier });
      }
      if (sql.includes("via = 'start'")) return Promise.resolve({ n: opts.recentStart ?? 0 });
      if (sql.startsWith("SELECT COUNT(*) AS n FROM investigations")) return Promise.resolve({ n: opts.recent ?? 0 });
      throw new Error(`unexpected SQL: ${sql}`);
    },
    run: () => {
      if (!sql.startsWith("INSERT INTO investigations")) throw new Error(`unexpected SQL: ${sql}`);
      inserts.push(args);
      return Promise.resolve({ meta: { changes: 1 } });
    },
  });
  const env = {
    DB: { prepare: (sql: string) => stmt(sql) },
    RESEARCH_RUN: { create },
    RUN_BUDGET_USD: "0.50",
    RUN_BUDGET_CALLS: "12",
  } as unknown as RunsEnv;
  return { env, inserts, create };
}

const post = (body: unknown): Request =>
  new Request("https://x.test/api/runs", { method: "POST", body: JSON.stringify(body) });
const hiring = { goal: "hiring", subject: "Jane Doe", anchor: "Acme", role: "Engineer" };
const api: RunOrigin = { via: "api" };
const start: RunOrigin = { via: "start", accountId: "acc_1", organizationId: "org_1" };

describe("createRun", () => {
  it("api origin inserts NULL account and org with via api and starts the Workflow", async () => {
    const { env, inserts, create } = makeEnv();
    const res = await createRun(post(hiring), env, api, NOW);
    expect(res.status).toBe(201);
    const { id } = await res.json<{ id: string }>();
    const row = inserts[0] ?? [];
    expect(row[0]).toBe(id);
    expect(row.slice(9)).toEqual(["api", null, null, null, null]);
    expect(create).toHaveBeenCalledWith({ id, params: { runId: id } });
  });

  it("start origin inserts the session ids and via start", async () => {
    const { env, inserts } = makeEnv();
    const res = await createRun(post(hiring), env, start, NOW);
    expect(res.status).toBe(201);
    expect((inserts[0] ?? []).slice(9)).toEqual(["start", null, null, "acc_1", "org_1"]);
  });

  it("reuses an earlier run for the same sourceUrl and goal", async () => {
    const { env, inserts, create } = makeEnv({ earlier: "run_old" });
    const res = await createRun(post({ ...hiring, sourceUrl: "https://example.com/p" }), env, api, NOW);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "run_old", reused: true });
    expect(inserts).toHaveLength(0);
    expect(create).not.toHaveBeenCalled();
  });

  it("429 at the global cap", async () => {
    const { env, inserts } = makeEnv({ recent: RUNS_PER_HOUR_CAP });
    expect((await createRun(post(hiring), env, api, NOW)).status).toBe(429);
    expect(inserts).toHaveLength(0);
  });

  it("start cap applies to start origin only", async () => {
    const { env } = makeEnv({ recentStart: START_PER_HOUR_CAP });
    expect((await createRun(post(hiring), env, start, NOW)).status).toBe(429);
    expect((await createRun(post(hiring), env, api, NOW)).status).toBe(201);
  });

  it("400 on an invalid body", async () => {
    const { env, inserts } = makeEnv();
    expect((await createRun(post({ goal: "hiring" }), env, api, NOW)).status).toBe(400);
    expect(inserts).toHaveLength(0);
  });
});
