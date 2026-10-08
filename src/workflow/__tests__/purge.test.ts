/**
 * Tests for the scheduled 7-day purge (purgeExpired) with hand-written D1 and R2 fakes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/purge.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Expired runs lose their R2 objects (sources, call results, intake CVs) and child rows, applications before the
 *   run row; applications without a run expire from received_at; newer data is untouched; empty purge terminates
 *
 * Design constraints:
 * - No module mocks; fakes match on SQL prefixes, keep state in plain arrays and record executed SQL in order
 * - The D1 fake enforces the applications.run_id foreign key like D1 does
 */
import { describe, expect, it } from "vitest";
import { purgeExpired } from "../purge";

const NOW = new Date("2026-10-09T03:00:00.000Z");
const OLD = "2026-10-01T10:00:00.000Z"; // 8 days before NOW
const NEW = "2026-10-08T10:00:00.000Z"; // 1 day before NOW

type Investigation = { id: string; created_at: string };
type Source = { run_id: string; r2_key: string };
type Call = { run_id: string; result_r2_key: string | null; provider_conversation_id: string | null };
type Application = { id: string; run_id: string | null; cv_key: string | null; received_at: string };
type Seed = { investigations?: Investigation[]; sources?: Source[]; calls?: Call[]; applications?: Application[] };
type Executed = { sql: string; args: unknown[] };

function makeEnv(seed: Seed = {}) {
  const investigations = [...(seed.investigations ?? [])];
  const sources = [...(seed.sources ?? [])];
  const calls = [...(seed.calls ?? [])];
  let applications = [...(seed.applications ?? [])];
  const executed: Executed[] = [];
  const r2Deletes: string[][] = [];

  const exec = (sql: string, args: unknown[]): unknown[] => {
    executed.push({ sql, args });
    if (sql.startsWith("SELECT id FROM investigations WHERE created_at < ?")) {
      return investigations.filter((r) => r.created_at < String(args[0])).slice(0, Number(args[1]));
    }
    if (sql.startsWith("SELECT r2_key FROM sources")) return sources.filter((r) => r.run_id === args[0]);
    if (sql.startsWith("SELECT result_r2_key, provider_conversation_id FROM calls")) return calls.filter((r) => r.run_id === args[0]);
    if (sql.startsWith("SELECT id, cv_key FROM applications WHERE run_id = ?")) return applications.filter((r) => r.run_id === args[0]);
    if (sql.startsWith("SELECT id, cv_key FROM applications WHERE run_id IS NULL AND received_at < ?")) {
      return applications.filter((r) => r.run_id === null && r.received_at < String(args[0])).slice(0, Number(args[1]));
    }
    if (sql.startsWith("DELETE FROM applications WHERE run_id = ?")) {
      applications = applications.filter((r) => r.run_id !== args[0]);
      return [];
    }
    if (sql.startsWith("DELETE FROM applications WHERE id = ?")) {
      applications = applications.filter((r) => r.id !== args[0]);
      return [];
    }
    if (sql.startsWith("DELETE FROM investigations WHERE id = ?")) {
      if (applications.some((r) => r.run_id === args[0])) throw new Error("D1_ERROR: FOREIGN KEY constraint failed: SQLITE_CONSTRAINT");
      const i = investigations.findIndex((r) => r.id === args[0]);
      if (i >= 0) investigations.splice(i, 1);
      return [];
    }
    if (sql.startsWith("DELETE FROM sources WHERE run_id = ?")) {
      sources.splice(0, sources.length, ...sources.filter((r) => r.run_id !== args[0]));
      return [];
    }
    if (sql.startsWith("DELETE FROM calls WHERE run_id = ?")) {
      calls.splice(0, calls.length, ...calls.filter((r) => r.run_id !== args[0]));
      return [];
    }
    if (/^DELETE FROM (claims|candidates|gaps|briefs|ledger_entries) WHERE run_id = \?$/.test(sql)) return [];
    if (sql.startsWith("DELETE FROM webhook_events WHERE conversation_id = ?")) return [];
    throw new Error(`unexpected SQL: ${sql}`);
  };

  type Stmt = { bind: (...a: unknown[]) => Stmt; all: () => Promise<{ results: unknown[] }>; run: () => Promise<{ meta: { changes: number } }>; exec: () => void };
  const stmt = (sql: string, args: unknown[] = []): Stmt => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    all: () => Promise.resolve().then(() => ({ results: exec(sql, args) })),
    run: () => Promise.resolve().then(() => (exec(sql, args), { meta: { changes: 1 } })),
    exec: () => {
      exec(sql, args);
    },
  });
  const fakeDb = {
    prepare: (sql: string) => stmt(sql),
    batch: (stmts: Stmt[]) =>
      Promise.resolve().then(() => {
        for (const s of stmts) s.exec();
        return [];
      }),
  };
  const fakeBucket = {
    delete: (keys: string | string[]) => {
      r2Deletes.push(typeof keys === "string" ? [keys] : keys);
      return Promise.resolve();
    },
  };
  // Narrow casts for the fakes only: D1Database / R2Bucket have many members purgeExpired never calls.
  const db = fakeDb as unknown as D1Database;
  const bucket = fakeBucket as unknown as R2Bucket;
  const index = (prefix: string): number => executed.findIndex((e) => e.sql.startsWith(prefix));
  return { db, bucket, executed, r2Deletes, index, state: { investigations, sources, calls, applications: () => applications } };
}

describe("purgeExpired", () => {
  it("deletes an expired intake run with its sources, call result and application CV, applications before the run row", async () => {
    const env = makeEnv({
      investigations: [{ id: "run-1", created_at: OLD }],
      sources: [
        { run_id: "run-1", r2_key: "run-1/src-a.json" },
        { run_id: "run-1", r2_key: "run-1/src-b.json" },
      ],
      calls: [{ run_id: "run-1", result_r2_key: "calls/call-1.json", provider_conversation_id: "conv-1" }],
      applications: [{ id: "app-1", run_id: "run-1", cv_key: "intake/app-1/cv.pdf", received_at: OLD }],
    });

    const res = await purgeExpired(env.db, env.bucket, NOW);

    expect(res).toEqual({ runs: 1, applications: 1 });
    expect(env.r2Deletes.flat().sort()).toEqual(["calls/call-1.json", "intake/app-1/cv.pdf", "run-1/src-a.json", "run-1/src-b.json"]);
    const appDelete = env.index("DELETE FROM applications WHERE run_id = ?");
    const runDelete = env.index("DELETE FROM investigations WHERE id = ?");
    expect(appDelete).toBeGreaterThanOrEqual(0);
    expect(runDelete).toBeGreaterThan(appDelete);
    expect(env.executed[appDelete]?.args).toEqual(["run-1"]);
    expect(env.executed.some((e) => e.sql.startsWith("DELETE FROM webhook_events") && e.args[0] === "conv-1")).toBe(true);
    expect(env.state.investigations).toEqual([]);
    expect(env.state.applications()).toEqual([]);
  });

  it("deletes an expired run without applications as before", async () => {
    const env = makeEnv({
      investigations: [{ id: "run-2", created_at: OLD }],
      sources: [{ run_id: "run-2", r2_key: "run-2/src.json" }],
      calls: [{ run_id: "run-2", result_r2_key: null, provider_conversation_id: null }],
    });

    const res = await purgeExpired(env.db, env.bucket, NOW);

    expect(res).toEqual({ runs: 1, applications: 0 });
    expect(env.r2Deletes).toEqual([["run-2/src.json"]]);
    const childDeletes = env.executed.filter((e) => /^DELETE FROM \w+ WHERE run_id = \?$/.test(e.sql)).map((e) => e.sql.split(" ")[2]);
    expect(childDeletes).toEqual(["sources", "claims", "candidates", "gaps", "briefs", "calls", "ledger_entries", "applications"]);
    expect(env.state.investigations).toEqual([]);
  });

  it("deletes applications without a run past the cutoff with their CV files, keeps newer ones", async () => {
    const env = makeEnv({
      applications: [
        { id: "app-old-cv", run_id: null, cv_key: "intake/app-old-cv/cv.pdf", received_at: OLD },
        { id: "app-old-nocv", run_id: null, cv_key: null, received_at: OLD },
        { id: "app-new", run_id: null, cv_key: "intake/app-new/cv.pdf", received_at: NEW },
      ],
    });

    const res = await purgeExpired(env.db, env.bucket, NOW);

    expect(res).toEqual({ runs: 0, applications: 2 });
    expect(env.r2Deletes).toEqual([["intake/app-old-cv/cv.pdf"]]);
    expect(env.r2Deletes.flat().every((k) => typeof k === "string" && k.length > 0)).toBe(true);
    expect(env.state.applications().map((a) => a.id)).toEqual(["app-new"]);
  });

  it("leaves a run newer than the cutoff and its application untouched", async () => {
    const env = makeEnv({
      investigations: [{ id: "run-new", created_at: NEW }],
      sources: [{ run_id: "run-new", r2_key: "run-new/src.json" }],
      applications: [{ id: "app-new", run_id: "run-new", cv_key: "intake/app-new/cv.pdf", received_at: OLD }],
    });

    const res = await purgeExpired(env.db, env.bucket, NOW);

    expect(res).toEqual({ runs: 0, applications: 0 });
    expect(env.r2Deletes).toEqual([]);
    expect(env.executed.filter((e) => e.sql.startsWith("DELETE"))).toEqual([]);
    expect(env.state.investigations).toHaveLength(1);
    expect(env.state.applications()).toHaveLength(1);
  });

  it("returns zero counts and terminates when nothing is expired", async () => {
    const env = makeEnv();

    const res = await purgeExpired(env.db, env.bucket, NOW);

    expect(res).toEqual({ runs: 0, applications: 0 });
    expect(env.r2Deletes).toEqual([]);
    expect(env.executed.map((e) => e.sql.split(" WHERE")[0])).toEqual(["SELECT id FROM investigations", "SELECT id, cv_key FROM applications"]);
  });
});
