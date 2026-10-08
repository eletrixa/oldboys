/**
 * Tests for startRun / runsStartedSince against a recording D1 fake and a Workflow spy.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/start-run.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Pin the investigations INSERT (columns and bind order) that POST /api/runs and the intake funnel share
 *
 * Design constraints:
 * - No module mocks; the fake records SQL + args
 */
import { describe, expect, it, vi } from "vitest";
import { runsStartedSince, startRun, type StartRunEnv } from "../start-run";

const NOW = new Date("2026-10-08T12:00:00.000Z");

function makeEnv(count = 0) {
  const calls: { sql: string; args: unknown[] }[] = [];
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    run: () => {
      calls.push({ sql, args });
      return Promise.resolve({ meta: { changes: 1 } });
    },
    first: () => {
      calls.push({ sql, args });
      return Promise.resolve({ n: count });
    },
  });
  const create = vi.fn((_: unknown) => Promise.resolve({ id: "x" }));
  const env = {
    DB: { prepare: (sql: string) => stmt(sql) },
    RESEARCH_RUN: { create },
    RUN_BUDGET_USD: "0.50",
    RUN_BUDGET_CALLS: "16",
  } as unknown as StartRunEnv;
  return { env, calls, create };
}

describe("startRun", () => {
  it("inserts the investigation and creates the Workflow with the same id", async () => {
    const { env, calls, create } = makeEnv();
    const { id } = await startRun(env, { goal: "hiring", role: "CTO", profileUrl: "https://www.linkedin.com/in/x1", via: "api" }, NOW);

    expect(calls).toHaveLength(1);
    const [insert] = calls;
    expect(insert?.sql).toMatch(
      /^INSERT INTO investigations \(id, subject, anchor, goal, status, budget_usd, budget_calls, created_at, source_url, role, via, profile_url, cv_text, application_id, account_id, organization_id, position_id, questions_json\)/,
    );
    expect(insert?.args).toEqual([
      id, "", "", "hiring", 0.5, 16, NOW.toISOString(), null, "CTO", "api", "https://www.linkedin.com/in/x1", null, null, null, null, null, null,
    ]);
    expect(create).toHaveBeenCalledWith({ id, params: { runId: id } });
  });

  it("keeps subject, anchor, sourceUrl and cvText, and writes application_id for intake", async () => {
    const { env, calls } = makeEnv();
    const { id } = await startRun(
      env,
      { goal: "due-diligence", subject: "Acme", anchor: "Prague", sourceUrl: "https://a.test/", cvText: "cv", via: "intake", applicationId: "app-1" },
      NOW,
    );
    expect(calls[0]?.args).toEqual([
      id, "Acme", "Prague", "due-diligence", 0.5, 16, NOW.toISOString(), "https://a.test/", null, "intake", null, "cv", "app-1", null, null, null, null,
    ]);
  });

  it("returns a fresh uuid per run", async () => {
    const { env } = makeEnv();
    const a = await startRun(env, { goal: "hiring", cvText: "cv", via: "api" }, NOW);
    const b = await startRun(env, { goal: "hiring", cvText: "cv", via: "api" }, NOW);
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.id).not.toBe(b.id);
  });
});

describe("runsStartedSince", () => {
  const since = new Date("2026-10-08T11:00:00.000Z");

  it("counts all runs since a time", async () => {
    const { env, calls } = makeEnv(7);
    expect(await runsStartedSince(env.DB, since)).toBe(7);
    expect(calls[0]).toEqual({ sql: "SELECT COUNT(*) AS n FROM investigations WHERE created_at > ?", args: [since.toISOString()] });
  });

  it("filters by via", async () => {
    const { env, calls } = makeEnv(2);
    expect(await runsStartedSince(env.DB, since, "intake")).toBe(2);
    expect(calls[0]).toEqual({
      sql: "SELECT COUNT(*) AS n FROM investigations WHERE created_at > ? AND via = ?",
      args: [since.toISOString(), "intake"],
    });
  });
});
