/**
 * Tests for startEnrichment (plans/010): which pool rows start a run, which are skipped and why, and the hourly caps.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/enrich.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Eligible rows start a hiring run with the position's questions and end 'run-started' with the new run id: pooled rows, and
 *   run-started rows whose run is done, failed, deleted or stalled (research again, A1–A5)
 * - Skips: duplicate ids deduped, over ENRICH_MAX, foreign pool, already started (a live run, or no run id yet), not ready, nothing to research
 * - The claim binds the read status and run id, so a lost race skips the row; a failed start restores the row's previous status and run
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

function makeEnv(opts: { apps?: Row[]; recent?: number; recentOrg?: number; positions?: string[]; runs?: Record<string, { status: string; last_at: string }>; afterRead?: (apps: Map<string, Row>) => void } = {}) {
  const apps = new Map((opts.apps ?? []).map((a) => [a.id as string, { ...a }]));
  const investigations: Row[] = [];
  const countArgs: unknown[][] = [];
  const claims: unknown[][] = [];
  const create = vi.fn((_: unknown) => Promise.resolve({ id: "wf" }));
  const exec = (sql: string, a: unknown[]): Row[] => {
    if (sql.startsWith("SELECT title, must_haves_json FROM positions")) {
      return (opts.positions ?? ["pos-1"]).includes(a[0] as string) ? [{ title: "Backend", must_haves_json: MUST }] : [];
    }
    if (sql.startsWith("SELECT a.id, a.status, a.linkedin_url, a.cv_text, a.run_id, i.status AS run_status")) {
      const read = [...apps.values()]
        .filter((r) => r.position_id === a[0] && a.slice(1).includes(r.id))
        .map((r) => {
          const run = opts.runs?.[r.run_id as string];
          return { ...r, run_status: run?.status ?? null, run_last_at: run?.last_at ?? null };
        });
      opts.afterRead?.(apps);
      return read;
    }
    if (sql.startsWith("SELECT COUNT(*) AS n, COALESCE(SUM(via = 'start'")) {
      countArgs.push(a);
      return [{ n: opts.recent ?? 0, org: opts.recentOrg ?? 0 }];
    }
    if (sql.startsWith("INSERT INTO investigations")) {
      investigations.push({ id: a[0], goal: a[3], profile_url: a[10], cv_text: a[11], application_id: a[12], position_id: a[15], via: a[9], account_id: a[13], organization_id: a[14], questions_json: a[16] });
      return [];
    }
    if (sql.startsWith("UPDATE applications SET status = 'run-started', run_id = NULL WHERE id = ? AND status = ? AND run_id IS ?")) {
      claims.push(a);
      const row = apps.get(a[0] as string);
      if (row === undefined || row.status !== a[1] || (row.run_id ?? null) !== (a[2] ?? null)) return [];
      row.status = "run-started";
      row.run_id = null;
      return [{ changed: 1 }];
    }
    if (sql.startsWith("UPDATE applications SET run_id = ? WHERE id = ?")) {
      Object.assign(apps.get(a[1] as string) ?? {}, { run_id: a[0] });
      return [];
    }
    if (sql.startsWith("UPDATE applications SET status = ?, run_id = ? WHERE id = ?")) {
      Object.assign(apps.get(a[2] as string) ?? {}, { status: a[0], run_id: a[1] });
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
  return { env, apps, investigations, create, countArgs, claims };
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
      runs: { "run-old": { status: "running", last_at: NOW.toISOString() } },
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

  const RECENT = "2026-10-09T11:50:00.000Z";
  const OLD = "2026-10-09T10:00:00.000Z";
  const started = (id: string, over: Row = {}): Row => app(id, { status: "run-started", run_id: `run-${id}`, ...over });

  it("A1: a row whose run is done starts a new run and moves to it", async () => {
    const { env, apps, create } = makeEnv({ apps: [started("a1")], runs: { "run-a1": { status: "done", last_at: OLD } } });
    const res = await startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1"], origin: api }, NOW);
    expect(res.ok && res.skipped).toEqual([]);
    expect(res.ok && res.started.map((s) => s.applicationId)).toEqual(["a1"]);
    expect(create).toHaveBeenCalledOnce();
    const runId = res.ok ? res.started[0]?.runId : undefined;
    expect(runId).not.toBe("run-a1");
    expect(apps.get("a1")).toMatchObject({ status: "run-started", run_id: runId });
  });

  it("A2: failed, deleted and stalled runs can be researched again", async () => {
    const { env, create } = makeEnv({
      apps: [started("failed"), started("deleted"), started("stalled")],
      runs: { "run-failed": { status: "failed", last_at: RECENT }, "run-stalled": { status: "running", last_at: OLD } },
    });
    const res = await startEnrichment(env, { positionId: "pos-1", applicationIds: ["failed", "deleted", "stalled"], origin: api }, NOW);
    expect(res.ok && res.started.map((s) => s.applicationId)).toEqual(["failed", "deleted", "stalled"]);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("A3: a running or paused run is still already started", async () => {
    const { env, create } = makeEnv({
      apps: [started("running"), started("paused"), started("inflight", { run_id: null })],
      runs: { "run-running": { status: "running", last_at: RECENT }, "run-paused": { status: "paused", last_at: OLD } },
    });
    const res = await startEnrichment(env, { positionId: "pos-1", applicationIds: ["running", "paused", "inflight"], origin: api }, NOW);
    expect(res.ok && res.skipped).toEqual([
      { applicationId: "running", reason: "already started", runId: "run-running" },
      { applicationId: "paused", reason: "already started", runId: "run-paused" },
      { applicationId: "inflight", reason: "already started" },
    ]);
    expect(create).not.toHaveBeenCalled();
  });

  it("A4: the claim binds the read status and run id; a lost claim skips the row", async () => {
    const { env, create, claims } = makeEnv({
      apps: [started("a1")],
      runs: { "run-a1": { status: "done", last_at: OLD } },
      // another request re-links the row between the read and the claim
      afterRead: (live) => { Object.assign(live.get("a1") ?? {}, { run_id: "run-a1-newer" }); },
    });
    const res = await startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1"], origin: api }, NOW);
    expect(claims).toEqual([["a1", "run-started", "run-a1"]]);
    expect(res.ok && res.skipped).toEqual([{ applicationId: "a1", reason: "already started" }]);
    expect(create).not.toHaveBeenCalled();
  });

  it("A5: a research-again row keeps its old run when the new one cannot start", async () => {
    const { env, apps, create } = makeEnv({ apps: [started("a1")], runs: { "run-a1": { status: "done", last_at: OLD } } });
    create.mockRejectedValueOnce(new Error("workflow down"));
    await expect(startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1"], origin: api }, NOW)).rejects.toThrow("workflow down");
    expect(apps.get("a1")).toMatchObject({ status: "run-started", run_id: "run-a1" });
  });

  it("gives a claimed row back to the pool when the run cannot start", async () => {
    const { env, apps, create } = makeEnv({ apps: [app("a1")] });
    create.mockRejectedValueOnce(new Error("workflow down"));
    await expect(startEnrichment(env, { positionId: "pos-1", applicationIds: ["a1"], origin: api }, NOW)).rejects.toThrow("workflow down");
    expect(apps.get("a1")).toMatchObject({ status: "pooled" });
  });
});
