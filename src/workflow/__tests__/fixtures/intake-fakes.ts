/**
 * Hand-written D1, R2 and Workflow fakes for the intake connector tests, keyed on the funnel's SQL prefixes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/fixtures/intake-fakes.ts
 * Deps:    vitest (vi.fn), src/workflow/intake (IntakeEnv type)
 * Tested:  n/a (test helper; used by the intake, form, startupjobs, apply and intake-email tests)
 *
 * Key responsibilities:
 * - `makeIntakeFakes(opts)`: an IntakeEnv whose DB serves the funnel's statements from plain maps, whose SOURCES
 *   records every put, and whose RESEARCH_RUN.create is a spy; returns the maps and recorders beside it
 * - Connector tests spread `env` and add their own secrets: `{ ...fakes.env, INTAKE_TOKEN } as FormIntakeEnv`
 *
 * Design constraints:
 * - No module mocks; an unknown statement throws, so a new funnel query fails loudly instead of returning nothing
 * - The applications INSERT enforces the (source, external_id) unique index like D1 does; `raceInsert` fakes a lost race
 * - The duplicate SELECT is matched on its column prefix and the capped re-read on `FROM applications WHERE id`,
 *   so a trimmed column list in the funnel does not break the connector tests
 * - `opts` is read on every call, so a test can clear `r2Error` or change `intakeRunsLastHour` between deliveries
 */
import { vi, type Mock } from "vitest";
import type { IntakeEnv } from "../../intake";

export type Row = Record<string, unknown>;

export type IntakeFakeOpts = {
  /** tag -> position; defaults to senior-be, a hiring role. */
  tags?: Record<string, { role: string; goal: string }>;
  /** StartupJobs offer id -> tag. */
  offerTags?: Record<string, string>;
  /** What the hourly cap query counts. */
  intakeRunsLastHour?: number;
  /** INTAKE_PER_HOUR_CAP var. */
  cap?: string;
  /** Every R2 put rejects with it. */
  r2Error?: Error;
  /** Every D1 statement throws it. */
  dbError?: Error;
  /** The applications INSERT fails as if another delivery of the same message committed first (row "app-winner"). */
  raceInsert?: boolean;
};

export type CvPut = { key: string; bytes: ArrayBuffer; contentType: string | undefined };

export type IntakeFakes = {
  env: IntakeEnv;
  apps: Map<string, Row>;
  investigations: Row[];
  puts: CvPut[];
  writes: string[];
  /** Bind arguments of every hourly-cap COUNT query. */
  countArgs: unknown[][];
  create: Mock<(params: unknown) => Promise<{ id: string }>>;
};

export function makeIntakeFakes(opts: IntakeFakeOpts = {}): IntakeFakes {
  const tags = new Map(Object.entries(opts.tags ?? { "senior-be": { role: "Senior backend engineer", goal: "hiring" } }));
  const offerTags = new Map(Object.entries(opts.offerTags ?? {}));
  const apps = new Map<string, Row>();
  const investigations: Row[] = [];
  const puts: CvPut[] = [];
  /** Every INSERT and UPDATE on applications, to prove a rejected request wrote nothing. */
  const writes: string[] = [];
  const countArgs: unknown[][] = [];
  const create = vi.fn((_: unknown) => Promise.resolve({ id: "wf" }));

  const exec = (sql: string, args: unknown[]): { rows: Row[]; changes: number } => {
    if (opts.dbError) throw opts.dbError;
    if (sql.startsWith("SELECT tag FROM intake_tags WHERE startupjobs_offer_id = ?")) {
      const tag = offerTags.get(args[0] as string);
      return { rows: tag !== undefined ? [{ tag }] : [], changes: 0 };
    }
    if (sql.startsWith("SELECT id, status, run_id, note, tag, linkedin_url") && sql.includes("FROM applications WHERE source = ?")) {
      const hit = [...apps.values()].find((a) => a.source === args[0] && a.external_id === args[1]);
      return { rows: hit ? [hit] : [], changes: 0 };
    }
    if (sql.startsWith("SELECT ") && sql.includes("FROM applications WHERE id = ?")) {
      const hit = apps.get(args[0] as string);
      return { rows: hit ? [hit] : [], changes: 0 };
    }
    if (sql.startsWith("INSERT INTO applications")) {
      writes.push(sql);
      const cols = /\(([^)]*)\)/.exec(sql)?.[1]?.split(", ") ?? [];
      const row: Row = Object.fromEntries(cols.map((c, i) => [c, args[i]]));
      row.status = "received";
      const clash = [...apps.values()].some((a) => a.source === row.source && a.external_id === row.external_id);
      if (opts.raceInsert === true) {
        apps.set("app-winner", { ...row, id: "app-winner", status: "run-started", run_id: "run-winner", note: null });
        throw new Error("D1_ERROR: UNIQUE constraint failed: applications.source, applications.external_id: SQLITE_CONSTRAINT");
      }
      if (clash) throw new Error("D1_ERROR: UNIQUE constraint failed: applications.source, applications.external_id");
      apps.set(row.id as string, row);
      return { rows: [], changes: 1 };
    }
    if (sql.startsWith("SELECT role, goal FROM intake_tags WHERE tag = ?")) {
      const t = tags.get(args[0] as string);
      return { rows: t ? [t] : [], changes: 0 };
    }
    if (sql.startsWith("SELECT COUNT(*) AS n FROM investigations")) {
      countArgs.push(args);
      return { rows: [{ n: opts.intakeRunsLastHour ?? 0 }], changes: 0 };
    }
    if (sql.startsWith("SELECT id FROM investigations WHERE application_id = ?")) {
      const hit = investigations.find((i) => i.application_id === args[0]);
      return { rows: hit ? [{ id: hit.id }] : [], changes: 0 };
    }
    if (sql.startsWith("INSERT INTO investigations")) {
      const cols = /\(([^)]*)\)/.exec(sql)?.[1]?.split(", ") ?? [];
      const values = [...args.slice(0, 4), "queued", ...args.slice(4)];
      investigations.push(Object.fromEntries(cols.map((c, i) => [c, values[i]])));
      return { rows: [], changes: 1 };
    }
    const update = /^UPDATE applications SET (.*) WHERE id = \?$/.exec(sql);
    if (update) {
      writes.push(sql);
      const cols = (update[1] ?? "").split(", ").map((c) => c.split(" = ")[0] ?? "");
      const row = apps.get(args[cols.length] as string);
      if (!row) return { rows: [], changes: 0 };
      cols.forEach((c, i) => (row[c] = args[i]));
      return { rows: [], changes: 1 };
    }
    throw new Error(`unexpected SQL: ${sql}`);
  };

  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: () => Promise.resolve().then(() => exec(sql, args).rows[0] ?? null),
    run: () => Promise.resolve().then(() => ({ meta: { changes: exec(sql, args).changes } })),
  });

  const env = {
    DB: { prepare: (sql: string) => stmt(sql) },
    RESEARCH_RUN: { create },
    RUN_BUDGET_USD: "0.50",
    RUN_BUDGET_CALLS: "16",
    INTAKE_PER_HOUR_CAP: opts.cap,
    SOURCES: {
      put: (key: string, bytes: ArrayBuffer, o?: { httpMetadata?: { contentType?: string } }) => {
        if (opts.r2Error) return Promise.reject(opts.r2Error);
        puts.push({ key, bytes, contentType: o?.httpMetadata?.contentType });
        return Promise.resolve(null);
      },
    },
  } as unknown as IntakeEnv;

  return { env, apps, investigations, puts, writes, countArgs, create };
}
