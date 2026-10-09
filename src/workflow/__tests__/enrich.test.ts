/**
 * Tests for startEnrichment (plans/010): which pool rows start a run, which are skipped and why, and the hourly caps.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/enrich.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Eligible pooled rows start a hiring run with the position's questions and become 'run-started' with the run id
 * - Skips: duplicate ids deduped, over ENRICH_MAX, foreign pool, already started, not ready, nothing to research
 * - 404 on an unknown position; 429 (nothing started) when the shared or per-organization cap would be passed
 *
 * Design constraints:
 * - No module mocks; the fake D1 matches SQL prefixes and throws on anything unexpected
 */
import { describe, expect, it, vi } from "vitest";
import { RUNS_PER_HOUR_CAP, START_PER_HOUR_CAP } from "@/domain/run-status";
import { ENRICH_MAX, startEnrichment } from "../enrich";
import type { StartRunEnv } from "../start-run";

type Row = Record<string, unknown>;
const NOW = new Date("2026-10-09T12:00:00.000Z");
const MUST = JSON.stringify([{ id: "mh-k8s", text: "Kubernetes", accepted_evidence: ["talk"] }]);

function makeEnv(opts: { apps?: Row[]; recent?: number; recentOrg?: number; positions?: string[] } = {}) {
  const apps = new Map((opts.apps ?? []).map((a) => [a.id as string, { ...a }]));
  const investigations: Row[] = [];
  const countArgs: unknown[][] = [];
  const create = vi.fn((_: unknown) => Promise.resolve({ id: "wf" }));
  const exec = (sql: string, a: unknown[]): Row[] => {
    if (sql.startsWith("SELECT title, must_haves_json FROM positions")) {
      return (opts.positions ?? ["pos-1"]).includes(a[0] as string) ? [{ title: "Backend", must_haves_json: MUST }] : [];
    }
    if (sql.startsWith("SELECT id, status, linkedin_url, cv_text, run_id FROM applications WHERE position_id = ? AND id IN")) {
      return [...apps.values()].filter((r) => r.position_id === a[0] && a.slice(1).includes(r.id));
    }
    if (sql.startsWith("SELECT COUNT(*) AS n, COALESCE(SUM(via = 'start'")) {
      countArgs.push(a);
      return [{ n: opts.recent ?? 0, org: opts.recentOrg ?? 0 }];
    }
    if (sql.startsWith("INSERT INTO investigations")) {
      investigations.push({ id: a[0], goal: a[3], profile_url: a[10], cv_text: a[11], application_id: a[12], position_id: a[15], via: a[9], account_id: a[13], organization_id: a[14], questions_json: a[16] });
      return [];
    }
    if (sql.startsWith("UPDATE applications SET status = 'run-started' WHERE id = ? AND status = 'pooled'")) {
      const row = apps.get(a[0] as string);
      if (row?.status !== "pooled") return [];
      row.status = "run-started";
      return [{ changed: 1 }];
    }
    if (sql.startsWith("UPDATE applications SET run_id = ? WHERE id = ?")) {
      Object.assign(apps.get(a[1] as string) ?? {}, { run_id: a[0] });
      return [];
    }
    if (sql.startsWith("UPDATE applications SET status = 'pooled' WHERE id = ?")) {
      Object.assign(apps.get(a[0] as string) ?? {}, { status: "pooled" });
      return [];
    }
    throw new Error(`unexpected SQL: ${sql}`);
  };
  const stmt = (sql: string, a: unknown[] = []) => ({
    bind: (...b: unknown[]) => stmt(sql, b),
    first: () => Promise.resolve(exec(sql, a)[0] ?? null),
    all: () => Promise.resolve({ results: exec(sql, a) }),
    run: () => Promise.resolve({ meta: { changes: exec(sql, a).length } }),
  });
  const env = { DB: { prepare: (s: string) => stmt(s) }, RESEARCH_RUN: { create }, RUN_BUDGET_USD: "0.50", RUN_BUDGET_CALLS: "16" } as unknown as StartRunEnv;
  return { env, apps, investigations, create, countArgs };
}

const app = (id: string, over: Row = {}): Row => ({ id, position_id: "pos-1", status: "pooled", linkedin_url: `https://www.linkedin.com/in/${id}`, cv_text: null, ...over });
const api = { via: "api" } as const;

describe("startEnrichment", () => {
  it("starts a hiring run per pooled row with the position's questions and links the application", async () => {
    const { env, apps, investigations, create } = makeEnv({ apps: [app("a1"), app("a2", { linkedin_url: null, cv_text: "cv text" })] });
    const res = await startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1", "a2"], origin: api }, NOW);
    expect(res).toMatchObject({ ok: true, skipped: [] });
    if (!res.ok) return;
    expect(res.started.map((s) => s.applicationId)).toEqual(["a1", "a2"]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(investigations[0]).toMatchObject({ goal: "hiring", via: "api", position_id: "pos-1", application_id: "a1", profile_url: "https://www.linkedin.com/in/a1", account_id: null });
    expect(investigations[1]).toMatchObject({ cv_text: "cv text", profile_url: null });
    expect(investigations[0]?.questions_json).toEqual(expect.stringContaining("Kubernetes"));
    expect(apps.get("a1")).toMatchObject({ status: "run-started", run_id: res.started[0]?.runId });
  });

  it("a session origin stores account and organization", async () => {
    const { env, investigations } = makeEnv({ apps: [app("a1")] });
    await startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1"], origin: { via: "start", accountId: "acc", organizationId: "org" } }, NOW);
    expect(investigations[0]).toMatchObject({ via: "start", account_id: "acc", organization_id: "org" });
  });

  it("404 for an unknown position, nothing started", async () => {
    const { env, create } = makeEnv({ apps: [app("a1")], positions: [] });
    expect(await startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1"], origin: api }, NOW)).toEqual({ ok: false, status: 404, error: "unknown position" });
    expect(create).not.toHaveBeenCalled();
  });

  it("skips with plain reasons and dedupes ids", async () => {
    const { env, create } = makeEnv({
      apps: [
        app("ok"),
        app("started", { status: "run-started", run_id: "run-old" }),
        app("capped", { status: "capped" }),
        app("empty", { linkedin_url: null }),
        app("other", { position_id: "pos-2" }),
      ],
    });
    const res = await startEnrichment(env, { positionId: "pos-1", applicationIds: ["ok", "ok", "started", "capped", "empty", "other", "ghost"], origin: api }, NOW);
    expect(res.ok && res.started.map((s) => s.applicationId)).toEqual(["ok"]);
    expect(res.ok && res.skipped).toEqual([
      { applicationId: "started", reason: "already started", runId: "run-old" },
      { applicationId: "capped", reason: "not ready" },
      { applicationId: "empty", reason: "no LinkedIn URL or CV text" },
      { applicationId: "other", reason: "not in this position's pool" },
      { applicationId: "ghost", reason: "not in this position's pool" },
    ]);
    expect(create).toHaveBeenCalledOnce();
  });

  it("ids beyond ENRICH_MAX are skipped as over limit", async () => {
    const ids = Array.from({ length: ENRICH_MAX + 2 }, (_, i) => `a${String(i)}`);
    const { env, create } = makeEnv({ apps: ids.map((id) => app(id)) });
    const res = await startEnrichment(env, { positionId: "pos-1", applicationIds: ids, origin: api }, NOW);
    expect(res.ok && res.started).toHaveLength(ENRICH_MAX);
    expect(res.ok && res.skipped).toEqual(ids.slice(ENRICH_MAX).map((applicationId) => ({ applicationId, reason: "over limit" })));
    expect(create).toHaveBeenCalledTimes(ENRICH_MAX);
  });

  it("429 and no run when eligible rows would pass the shared hourly cap", async () => {
    const { env, create, apps } = makeEnv({ apps: [app("a1"), app("a2")], recent: RUNS_PER_HOUR_CAP - 1 });
    expect(await startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1", "a2"], origin: api }, NOW)).toEqual({
      ok: false,
      status: 429,
      error: "run cap reached: at most 1 more runs this hour",
    });
    expect(create).not.toHaveBeenCalled();
    expect(apps.get("a1")).toMatchObject({ status: "pooled" });
  });

  it("exactly filling the cap is allowed", async () => {
    const { env, create } = makeEnv({ apps: [app("a1"), app("a2")], recent: RUNS_PER_HOUR_CAP - 2 });
    expect((await startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1", "a2"], origin: api }, NOW)).ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("a session is also held to the per-organization cap", async () => {
    const { env, create, countArgs } = makeEnv({ apps: [app("a1")], recentOrg: START_PER_HOUR_CAP });
    const res = await startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1"], origin: { via: "start", accountId: "acc", organizationId: "org" } }, NOW);
    expect(res).toMatchObject({ ok: false, status: 429 });
    expect(countArgs[0]?.[0]).toBe("org");
    expect(create).not.toHaveBeenCalled();
  });

  it("no cap query when nothing is eligible", async () => {
    const { env, countArgs } = makeEnv({ apps: [app("a1", { status: "run-started" })] });
    const res = await startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1"], origin: api }, NOW);
    expect(res).toMatchObject({ ok: true, started: [] });
    expect(countArgs).toHaveLength(0);
  });

  it("gives a claimed row back to the pool when the run cannot start", async () => {
    const { env, apps, create } = makeEnv({ apps: [app("a1")] });
    create.mockRejectedValueOnce(new Error("workflow down"));
    await expect(startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1"], origin: api }, NOW)).rejects.toThrow("workflow down");
    expect(apps.get("a1")).toMatchObject({ status: "pooled" });
  });
});
