/**
 * Purge tests for the applications and positions sweeps, with a small local fake D1 and R2 that record statements and deletes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/purge-positions.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Cover U1-U8 of specs/positions-purge.md: expiry, R2 keys, link clearing order, batches, idempotence, un-migrated database
 * - U9-U10: expired run-less applications lose their R2 CV and row; a run's applications go before its row (applications.run_id references investigations)
 *
 * Design constraints:
 * - No module mocks; the fake matches SQL prefixes and throws on anything unexpected
 */
import { describe, expect, it } from "vitest";
import { purgeExpired } from "@/workflow/purge";

type Pos = { id: string; r2_key: string | null; expires_at: string };
type App = { id: string; cv_key: string | null; received_at: string; run_id?: string };
const NOW = new Date("2026-10-09T10:00:00.000Z");
const PAST = "2026-10-09T09:00:00.000Z";

function makeEnv(opts: { positions?: Pos[]; applications?: App[]; runIds?: string[]; noTable?: boolean; positionsError?: Error } = {}) {
  const positions = [...(opts.positions ?? [])];
  const applications = [...(opts.applications ?? [])];
  const runs = [...(opts.runIds ?? [])];
  const log: string[] = [];
  const selects: number[] = [];
  const deleted: string[][] = [];
  const batches: number[] = [];
  const exec = (q: string, a: unknown[]): Record<string, unknown>[] => {
    if (q.startsWith("SELECT id, r2_key FROM positions")) {
      if (opts.positionsError) throw opts.positionsError;
      const rows = positions.filter((p) => p.expires_at < (a[0] as string)).slice(0, 20);
      selects.push(rows.length);
      return rows;
    }
    if (q.startsWith("SELECT 1 AS present FROM sqlite_master")) return opts.noTable === true ? [] : [{ present: 1 }];
    if (q.startsWith("UPDATE investigations SET position_id = NULL WHERE position_id IN")) {
      log.push(`update:${a.join(",")}`);
      return [];
    }
    if (q.startsWith("DELETE FROM positions WHERE id IN")) {
      log.push(`delete:${a.join(",")}`);
      for (const id of a) positions.splice(positions.findIndex((p) => p.id === id), 1);
      return [];
    }
    if (q.startsWith("SELECT id FROM investigations")) return runs.splice(0, 20).map((id) => ({ id }));
    if (q.startsWith("DELETE FROM investigations")) {
      log.push(`delete-run:${String(a[0])}`);
      return [];
    }
    if (q.startsWith("SELECT id, cv_key FROM applications WHERE run_id = ?")) return applications.filter((x) => x.run_id === a[0]);
    if (q.startsWith("SELECT id, cv_key FROM applications WHERE run_id IS NULL")) {
      return applications.filter((x) => x.run_id === undefined && x.received_at < (a[0] as string)).slice(0, 20);
    }
    if (q.startsWith("DELETE FROM applications WHERE")) {
      const gone = applications.filter((x) => (q.includes("run_id = ?") ? x.run_id : x.id) === a[0]);
      log.push(...gone.map((x) => `delete-app:${x.id}`));
      for (const x of gone) applications.splice(applications.indexOf(x), 1);
      return [];
    }
    if (/^(SELECT .* FROM (sources|calls)|DELETE FROM|SELECT r2_key)/.test(q)) return [];
    throw new Error(`unexpected SQL: ${q}`);
  };
  const stmt = (q: string, a: unknown[] = []) => ({
    bind: (...b: unknown[]) => stmt(q, b),
    first: () => Promise.resolve(exec(q, a)[0] ?? null),
    all: () => {
      try {
        return Promise.resolve({ results: exec(q, a) });
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
    },
    run: () => Promise.resolve({ results: exec(q, a) }),
  });
  const db = {
    prepare: (q: string) => stmt(q),
    batch: (s: { run: () => Promise<unknown> }[]) => {
      batches.push(s.length);
      return Promise.all(s.map((x) => x.run()));
    },
  } as unknown as D1Database;
  const bucket = { delete: (keys: string[]) => (deleted.push(keys), Promise.resolve()) } as unknown as R2Bucket;
  return { db, bucket, positions, applications, log, selects, deleted, batches };
}

describe("purgeExpired positions", () => {
  it("U1: an expired position is deleted and its R2 key passed to bucket.delete", async () => {
    const env = makeEnv({ positions: [{ id: "p1", r2_key: "positions/p1.json", expires_at: PAST }] });
    const r = await purgeExpired(env.db, env.bucket, NOW);
    expect(r).toEqual({ runs: 0, positions: 1, applications: 0 });
    expect(env.positions).toHaveLength(0);
    expect(env.deleted).toEqual([["positions/p1.json"]]);
  });

  it("U2: a position expiring one second from now is untouched and its key not deleted", async () => {
    const env = makeEnv({ positions: [{ id: "p1", r2_key: "positions/p1.json", expires_at: "2026-10-09T10:00:01.000Z" }] });
    const r = await purgeExpired(env.db, env.bucket, NOW);
    expect(r.positions).toBe(0);
    expect(env.positions).toHaveLength(1);
    expect(env.deleted).toEqual([]);
  });

  it("U3: a position with a null r2_key is deleted and no null reaches the delete call", async () => {
    const env = makeEnv({ positions: [{ id: "p1", r2_key: null, expires_at: PAST }, { id: "p2", r2_key: "positions/p2.json", expires_at: PAST }] });
    await purgeExpired(env.db, env.bucket, NOW);
    expect(env.positions).toHaveLength(0);
    expect(env.deleted).toEqual([["positions/p2.json"]]);
  });

  it("U4: investigations lose their position_id and the UPDATE is recorded before the DELETE", async () => {
    const env = makeEnv({ positions: [{ id: "p1", r2_key: null, expires_at: PAST }] });
    await purgeExpired(env.db, env.bucket, NOW);
    expect(env.log).toEqual(["update:p1", "delete:p1"]);
    expect(env.batches).toEqual([2]);
  });

  it("U5: 45 expired positions run in batches of 20 and the result reports 45", async () => {
    const positions = Array.from({ length: 45 }, (_, i) => ({ id: `p${String(i)}`, r2_key: `positions/p${String(i)}.json`, expires_at: PAST }));
    const env = makeEnv({ positions });
    const r = await purgeExpired(env.db, env.bucket, NOW);
    expect(r.positions).toBe(45);
    expect(env.selects).toEqual([20, 20, 5, 0]);
    expect(env.deleted.map((k) => k.length)).toEqual([20, 20, 5]);
    expect(env.batches).toEqual([2, 2, 2]);
  });

  it("U6: a second sweep deletes nothing and returns positions 0", async () => {
    const env = makeEnv({ positions: [{ id: "p1", r2_key: "positions/p1.json", expires_at: PAST }] });
    await purgeExpired(env.db, env.bucket, NOW);
    const again = await purgeExpired(env.db, env.bucket, NOW);
    expect(again).toEqual({ runs: 0, positions: 0, applications: 0 });
    expect(env.deleted).toHaveLength(1);
  });

  it("U7: the runs count is unchanged when there are no positions", async () => {
    const env = makeEnv({ runIds: ["r1", "r2"] });
    const r = await purgeExpired(env.db, env.bucket, NOW);
    expect(r).toEqual({ runs: 2, positions: 0, applications: 0 });
  });

  it("U8: a missing positions table yields positions 0 and the runs purge still runs, any other error rejects", async () => {
    const missing = makeEnv({ noTable: true, runIds: ["r1"] });
    await expect(purgeExpired(missing.db, missing.bucket, NOW)).resolves.toEqual({ runs: 1, positions: 0, applications: 0 });
    const broken = makeEnv({ positionsError: new Error("D1_ERROR: disk I/O error") });
    await expect(purgeExpired(broken.db, broken.bucket, NOW)).rejects.toThrow("disk I/O");
  });
});

describe("purgeExpired applications", () => {
  const EIGHT_DAYS_AGO = "2026-10-01T10:00:00.000Z";
  const SIX_DAYS_AGO = "2026-10-03T10:00:00.000Z";

  it("U9: run-less applications received over 7 days ago lose their R2 CV and their row; a younger one and a null key are left alone", async () => {
    const env = makeEnv({
      applications: [
        { id: "a1", cv_key: "intake/a1/cv.pdf", received_at: EIGHT_DAYS_AGO },
        { id: "a2", cv_key: null, received_at: EIGHT_DAYS_AGO },
        { id: "a3", cv_key: "intake/a3/cv.pdf", received_at: SIX_DAYS_AGO },
      ],
    });
    const r = await purgeExpired(env.db, env.bucket, NOW);
    expect(r).toEqual({ runs: 0, positions: 0, applications: 2 });
    expect(env.applications.map((a) => a.id)).toEqual(["a3"]);
    expect(env.deleted).toEqual([["intake/a1/cv.pdf"]]);
  });

  it("U10: application rows go before the run rows they reference", async () => {
    const env = makeEnv({ applications: [{ id: "a1", cv_key: null, received_at: EIGHT_DAYS_AGO, run_id: "r1" }], runIds: ["r1"] });
    await purgeExpired(env.db, env.bucket, NOW);
    expect(env.log).toEqual(["delete-app:a1", "delete-run:r1"]);
  });
});
