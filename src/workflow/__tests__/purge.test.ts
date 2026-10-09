/**
 * Tests for the per-run delete (deleteRunData) and the scheduled 7-day purge (purgeExpired) with hand-written D1 and R2 fakes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/purge.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - deleteRunData removes every R2 object and row of one run (other runs untouched) and counts what it removed
 * - Expired runs lose their R2 objects (sources, call results, intake CVs) and child rows, applications before the
 *   run row; applications without a run expire from received_at; newer data is untouched; empty purge terminates
 *
 * Design constraints:
 * - No module mocks; fakes match on SQL prefixes, keep state in plain arrays and record executed SQL in order;
 *   DELETEs report the removed row count as meta.changes like D1
 * - The D1 fake enforces the applications.run_id foreign key like D1 does; the positions table exists and is empty
 *   (the positions sweep is covered in purge-positions.test.ts)
 */
import { describe, expect, it } from "vitest";
import { deleteRunData, purgeExpired } from "../purge";

const NOW = new Date("2026-10-09T03:00:00.000Z");
const OLD = "2026-10-01T10:00:00.000Z"; // 8 days before NOW
const NEW = "2026-10-08T10:00:00.000Z"; // 1 day before NOW

type Investigation = { id: string; created_at: string };
type Source = { run_id: string; r2_key: string };
type Call = { run_id: string; result_r2_key: string | null; provider_conversation_id: string | null };
type Application = { id: string; run_id: string | null; cv_key: string | null; received_at: string };
type Child = { table: "claims" | "candidates" | "gaps" | "briefs" | "ledger_entries"; run_id: string };
type Seed = {
  investigations?: Investigation[];
  sources?: Source[];
  calls?: Call[];
  applications?: Application[];
  children?: Child[];
  webhookEvents?: { conversation_id: string }[];
};
type Executed = { sql: string; args: unknown[] };

function makeEnv(seed: Seed = {}) {
  const investigations = [...(seed.investigations ?? [])];
  const sources = [...(seed.sources ?? [])];
  const calls = [...(seed.calls ?? [])];
  let applications = [...(seed.applications ?? [])];
  let children = [...(seed.children ?? [])];
  let webhookEvents = [...(seed.webhookEvents ?? [])];
  const executed: Executed[] = [];
  const r2Deletes: string[][] = [];

  // SELECTs return the matching rows, DELETEs the removed rows (their count is the statement's meta.changes).
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
      const gone = applications.filter((r) => r.run_id === args[0]);
      applications = applications.filter((r) => r.run_id !== args[0]);
      return gone;
    }
    if (sql.startsWith("DELETE FROM applications WHERE id = ?")) {
      const gone = applications.filter((r) => r.id === args[0]);
      applications = applications.filter((r) => r.id !== args[0]);
      return gone;
    }
    if (sql.startsWith("DELETE FROM investigations WHERE id = ?")) {
      if (applications.some((r) => r.run_id === args[0])) throw new Error("D1_ERROR: FOREIGN KEY constraint failed: SQLITE_CONSTRAINT");
      const i = investigations.findIndex((r) => r.id === args[0]);
      return i >= 0 ? investigations.splice(i, 1) : [];
    }
    if (sql.startsWith("DELETE FROM sources WHERE run_id = ?")) {
      const gone = sources.filter((r) => r.run_id === args[0]);
      sources.splice(0, sources.length, ...sources.filter((r) => r.run_id !== args[0]));
      return gone;
    }
    if (sql.startsWith("DELETE FROM calls WHERE run_id = ?")) {
      const gone = calls.filter((r) => r.run_id === args[0]);
      calls.splice(0, calls.length, ...calls.filter((r) => r.run_id !== args[0]));
      return gone;
    }
    const child = /^DELETE FROM (claims|candidates|gaps|briefs|ledger_entries) WHERE run_id = \?$/.exec(sql);
    if (child) {
      const gone = children.filter((r) => r.table === child[1] && r.run_id === args[0]);
      children = children.filter((r) => !gone.includes(r));
      return gone;
    }
    if (sql.startsWith("DELETE FROM webhook_events WHERE conversation_id = ?")) {
      const gone = webhookEvents.filter((r) => r.conversation_id === args[0]);
      webhookEvents = webhookEvents.filter((r) => r.conversation_id !== args[0]);
      return gone;
    }
    if (sql.startsWith("SELECT 1 AS present FROM sqlite_master")) return [{ present: 1 }];
    if (sql.startsWith("SELECT id, r2_key FROM positions")) return [];
    throw new Error(`unexpected SQL: ${sql}`);
  };

  type Stmt = {
    bind: (...a: unknown[]) => Stmt;
    all: () => Promise<{ results: unknown[] }>;
    first: () => Promise<unknown>;
    run: () => Promise<{ meta: { changes: number } }>;
    exec: () => unknown[];
  };
  const stmt = (sql: string, args: unknown[] = []): Stmt => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: () => Promise.resolve().then(() => exec(sql, args)[0] ?? null),
    all: () => Promise.resolve().then(() => ({ results: exec(sql, args) })),
    run: () => Promise.resolve().then(() => ({ meta: { changes: exec(sql, args).length } })),
    exec: () => exec(sql, args),
  });
  const fakeDb = {
    prepare: (sql: string) => stmt(sql),
    batch: (stmts: Stmt[]) => Promise.resolve().then(() => stmts.map((s) => ({ meta: { changes: s.exec().length } }))),
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
  return { db, bucket, executed, r2Deletes, index, state: { investigations, sources, calls, applications: () => applications, children: () => children, webhookEvents: () => webhookEvents } };
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

    expect(res).toEqual({ runs: 1, positions: 0, applications: 1 });
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

    expect(res).toEqual({ runs: 1, positions: 0, applications: 0 });
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

    expect(res).toEqual({ runs: 0, positions: 0, applications: 2 });
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

    expect(res).toEqual({ runs: 0, positions: 0, applications: 0 });
    expect(env.r2Deletes).toEqual([]);
    expect(env.executed.filter((e) => e.sql.startsWith("DELETE"))).toEqual([]);
    expect(env.state.investigations).toHaveLength(1);
    expect(env.state.applications()).toHaveLength(1);
  });

  it("returns zero counts and terminates when nothing is expired", async () => {
    const env = makeEnv();

    const res = await purgeExpired(env.db, env.bucket, NOW);

    expect(res).toEqual({ runs: 0, positions: 0, applications: 0 });
    expect(env.r2Deletes).toEqual([]);
    expect(env.executed.map((e) => e.sql.split(" WHERE")[0])).toEqual([
      "SELECT id FROM investigations",
      "SELECT id, cv_key FROM applications",
      "SELECT 1 AS present FROM sqlite_master",
      "SELECT id, r2_key FROM positions",
    ]);
  });
});

describe("deleteRunData", () => {
  const seed = (): Seed => ({
    investigations: [
      { id: "run-1", created_at: NEW },
      { id: "run-other", created_at: NEW },
    ],
    sources: [
      { run_id: "run-1", r2_key: "run-1/src-a.json" },
      { run_id: "run-1", r2_key: "run-1/src-b.json" },
      { run_id: "run-other", r2_key: "run-other/src.json" },
    ],
    calls: [
      { run_id: "run-1", result_r2_key: "calls/call-1.json", provider_conversation_id: "conv-1" },
      { run_id: "run-1", result_r2_key: null, provider_conversation_id: null },
    ],
    applications: [{ id: "app-1", run_id: "run-1", cv_key: "intake/app-1/cv.pdf", received_at: NEW }],
    children: [
      { table: "claims", run_id: "run-1" },
      { table: "claims", run_id: "run-1" },
      { table: "claims", run_id: "run-1" },
      { table: "candidates", run_id: "run-1" },
      { table: "gaps", run_id: "run-1" },
      { table: "briefs", run_id: "run-1" },
      { table: "ledger_entries", run_id: "run-1" },
      { table: "ledger_entries", run_id: "run-1" },
      { table: "claims", run_id: "run-other" },
    ],
    webhookEvents: [{ conversation_id: "conv-1" }, { conversation_id: "conv-other" }],
  });

  it("deletes one run's R2 objects and rows, whatever its age, and counts what it removed", async () => {
    const env = makeEnv(seed());

    const counts = await deleteRunData(env.db, env.bucket, "run-1");

    expect(counts).toEqual({
      sources: 2,
      claims: 3,
      candidates: 1,
      gaps: 1,
      briefs: 1,
      calls: 2,
      ledger_entries: 2,
      applications: 1,
      webhook_events: 1,
      cv_files: 1,
      r2_objects: 4,
    });
    expect(env.r2Deletes.flat().sort()).toEqual(["calls/call-1.json", "intake/app-1/cv.pdf", "run-1/src-a.json", "run-1/src-b.json"]);
    expect(env.state.investigations.map((r) => r.id)).toEqual(["run-other"]);
    expect(env.state.sources).toEqual([{ run_id: "run-other", r2_key: "run-other/src.json" }]);
    expect(env.state.calls).toEqual([]);
    expect(env.state.applications()).toEqual([]);
    expect(env.state.children()).toEqual([{ table: "claims", run_id: "run-other" }]);
    expect(env.state.webhookEvents()).toEqual([{ conversation_id: "conv-other" }]);
  });

  it("deletes in the order the purge relies on: R2 first, child tables, applications, then the run row", async () => {
    const env = makeEnv(seed());

    await deleteRunData(env.db, env.bucket, "run-1");

    const deletes = env.executed.filter((e) => e.sql.startsWith("DELETE")).map((e) => e.sql.split(" ")[2]);
    expect(deletes).toEqual(["sources", "claims", "candidates", "gaps", "briefs", "calls", "ledger_entries", "applications", "webhook_events", "investigations"]);
  });

  it("returns zero counts for a run without collected data and touches no R2 object", async () => {
    const env = makeEnv({ investigations: [{ id: "run-empty", created_at: NEW }] });

    const counts = await deleteRunData(env.db, env.bucket, "run-empty");

    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
    expect(env.r2Deletes).toEqual([]);
    expect(env.state.investigations).toEqual([]);
  });

  it("is what purgeExpired runs per expired run (same SQL in the same order)", async () => {
    const onDemand = makeEnv({ ...seed(), investigations: [{ id: "run-1", created_at: OLD }] });
    const scheduled = makeEnv({ ...seed(), investigations: [{ id: "run-1", created_at: OLD }] });

    await deleteRunData(onDemand.db, onDemand.bucket, "run-1");
    await purgeExpired(scheduled.db, scheduled.bucket, NOW);

    const perRun = (executed: Executed[]) => executed.filter((e) => e.args[0] === "run-1" || e.args[0] === "conv-1").map((e) => e.sql);
    expect(perRun(scheduled.executed)).toEqual(perRun(onDemand.executed));
    expect(scheduled.r2Deletes).toEqual(onDemand.r2Deletes);
  });
});
