/**
 * Tests for the intake funnel (ingestApplication) with hand-written D1, R2 and Workflow fakes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/intake.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover specs/intake/funnel.md: happy path, CV-only PDF, duplicate and insert race, unknown tag, sender not
 *   allowed, incomplete, capped (and the capped retry), R2 failure leaving the row at 'received'
 *
 * Design constraints:
 * - No module mocks; fakes match on SQL prefixes and keep state in plain maps
 */
import { describe, expect, it, vi } from "vitest";
import { tinyPdf } from "@/domain/__tests__/fixtures/tiny-pdf";
import { ingestApplication, type IntakeEnv } from "../intake";

const NOW = new Date("2026-10-08T12:00:00.000Z");
const PROFILE = "https://www.linkedin.com/in/josef-buryan";

type Row = Record<string, unknown>;

function makeEnv(opts: { intakeRunsLastHour?: number; cap?: string; r2Error?: Error; raceInsert?: boolean } = {}) {
  const tags = new Map<string, Row>([["senior-be", { role: "Senior backend engineer", goal: "hiring" }]]);
  const apps = new Map<string, Row>();
  const investigations: Row[] = [];
  const puts: { key: string; size: number; contentType: string | undefined }[] = [];
  const create = vi.fn((_: unknown) => Promise.resolve({ id: "wf" }));
  const countArgs: unknown[][] = [];

  const exec = (sql: string, args: unknown[]): { rows: Row[]; changes: number } => {
    if (sql.startsWith("SELECT id, status, run_id, note, tag, linkedin_url, cv_text FROM applications")) {
      const hit = [...apps.values()].find((a) => a.source === args[0] && a.external_id === args[1]);
      return { rows: hit ? [hit] : [], changes: 0 };
    }
    if (sql.startsWith("INSERT INTO applications")) {
      const cols = /\(([^)]*)\)/.exec(sql)?.[1]?.split(", ") ?? [];
      const row: Row = Object.fromEntries(cols.map((c, i) => [c, args[i]]));
      row.status = "received";
      const clash = [...apps.values()].some((a) => a.source === row.source && a.external_id === row.external_id);
      if (opts.raceInsert === true) {
        // Another delivery committed the same message between our SELECT and INSERT.
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
    if (sql.startsWith("INSERT INTO investigations")) {
      const cols = /\(([^)]*)\)/.exec(sql)?.[1]?.split(", ") ?? [];
      const values = [...args.slice(0, 4), "queued", ...args.slice(4)];
      investigations.push(Object.fromEntries(cols.map((c, i) => [c, values[i]])));
      return { rows: [], changes: 1 };
    }
    const update = /^UPDATE applications SET (.*) WHERE id = \?$/.exec(sql);
    if (update) {
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
        puts.push({ key, size: bytes.byteLength, contentType: o?.httpMetadata?.contentType });
        return Promise.resolve(null);
      },
    },
  } as unknown as IntakeEnv;
  return { env, apps, investigations, puts, create, countArgs };
}

const base = { source: "email", externalId: "<m1@mail.test>", tag: "senior-be", name: "Josef Buryan", email: "josef@mail.test" } as const;

describe("ingestApplication", () => {
  it("LinkedIn-only application starts an intake run with the tag's role", async () => {
    const { env, apps, investigations, create, countArgs } = makeEnv();
    const res = await ingestApplication({ ...base, linkedinUrl: "cz.linkedin.com/in/Josef-Buryan?trk=x" }, env, NOW);

    expect(res).toMatchObject({ status: "run-started", duplicate: false, note: null });
    expect(res.runId).toBe(investigations[0]?.id);
    expect(investigations[0]).toMatchObject({
      via: "intake",
      role: "Senior backend engineer",
      goal: "hiring",
      profile_url: PROFILE,
      cv_text: null,
      application_id: res.applicationId,
    });
    expect(create).toHaveBeenCalledOnce();
    expect(countArgs[0]).toEqual([new Date(NOW.getTime() - 3_600_000).toISOString(), "intake"]);
    expect(apps.get(res.applicationId)).toMatchObject({
      source: "email",
      external_id: "<m1@mail.test>",
      tag: "senior-be",
      name: "Josef Buryan",
      email: "josef@mail.test",
      status: "run-started",
      run_id: res.runId,
      linkedin_url: PROFILE,
      received_at: NOW.toISOString(),
    });
  });

  it("CV-only PDF is stored in R2 and its text starts the run", async () => {
    const { env, apps, puts, investigations } = makeEnv();
    const cv = { bytes: tinyPdf("Josef Buryan Kubernetes"), filename: "../My CV.pdf", contentType: "application/pdf" };
    const res = await ingestApplication({ ...base, cv }, env, NOW);

    expect(res.status).toBe("run-started");
    const key = `intake/${res.applicationId}/My_CV.pdf`;
    expect(puts).toEqual([{ key, size: cv.bytes.byteLength, contentType: "application/pdf" }]);
    expect(apps.get(res.applicationId)).toMatchObject({ cv_key: key, cv_text: "Josef Buryan Kubernetes", linkedin_url: null });
    expect(investigations[0]).toMatchObject({ cv_text: "Josef Buryan Kubernetes", profile_url: null });
  });

  it("a second delivery returns the first row and never starts a second run", async () => {
    const { env, apps, create } = makeEnv();
    const first = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);
    const again = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);

    expect(again).toEqual({ ...first, duplicate: true });
    expect(create).toHaveBeenCalledOnce();
    expect(apps.size).toBe(1);
  });

  it("an insert race returns the winner's row as a duplicate", async () => {
    const { env, create } = makeEnv({ raceInsert: true });
    const res = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);
    expect(res).toEqual({ applicationId: "app-winner", status: "run-started", runId: "run-winner", duplicate: true, note: null });
    expect(create).not.toHaveBeenCalled();
  });

  it("unknown tag is unmatched and starts no run", async () => {
    const { env, apps, create } = makeEnv();
    const res = await ingestApplication({ ...base, tag: "nope", linkedinUrl: PROFILE }, env, NOW);
    expect(res).toMatchObject({ status: "unmatched", runId: null, note: "unknown tag" });
    expect(apps.get(res.applicationId)?.tag).toBe("nope");
    expect(create).not.toHaveBeenCalled();
  });

  it("a missing or malformed tag is unmatched without a tag lookup", async () => {
    const { env } = makeEnv();
    expect((await ingestApplication({ ...base, tag: undefined, linkedinUrl: PROFILE }, env, NOW)).status).toBe("unmatched");
    expect((await ingestApplication({ ...base, externalId: "m2", tag: "Bad Tag!", linkedinUrl: PROFILE }, env, NOW)).status).toBe("unmatched");
  });

  it("sender not allowed is unmatched", async () => {
    const { env, create } = makeEnv();
    const res = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW, { senderAllowed: false });
    expect(res).toMatchObject({ status: "unmatched", note: "sender not allowed" });
    expect(create).not.toHaveBeenCalled();
  });

  it("no profile and no CV text is incomplete, with the parser notes", async () => {
    const { env, apps, create } = makeEnv();
    const res = await ingestApplication({ ...base, linkedinUrl: "linkedin.com/company/acme", note: "from Jobs.cz" }, env, NOW);
    expect(res.status).toBe("incomplete");
    expect(res.note).toBe(
      "no LinkedIn profile URL and no readable CV text; not a LinkedIn profile URL: linkedin.com/company/acme; from Jobs.cz",
    );
    expect(apps.get(res.applicationId)?.note).toBe(res.note);
    expect(create).not.toHaveBeenCalled();
  });

  it("an unsupported CV file is stored, noted and leaves the application incomplete", async () => {
    const { env, puts } = makeEnv();
    const cv = { bytes: new ArrayBuffer(8), filename: "cv.docx", contentType: "application/vnd.openxmlformats" };
    const res = await ingestApplication({ ...base, cv }, env, NOW);
    expect(res.status).toBe("incomplete");
    expect(res.note).toContain("unsupported CV format application/vnd.openxmlformats");
    expect(puts).toHaveLength(1);
  });

  it("a capped application re-decides on the next delivery and starts the run once the hour has room", async () => {
    const opts = { intakeRunsLastHour: 10 };
    const { env, apps, investigations, create } = makeEnv(opts);
    const first = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);
    expect(first.status).toBe("capped");
    expect(create).not.toHaveBeenCalled();

    const stillFull = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);
    expect(stillFull).toMatchObject({ applicationId: first.applicationId, status: "capped", duplicate: true });

    opts.intakeRunsLastHour = 0;
    const retried = await ingestApplication({ ...base, linkedinUrl: "https://linkedin.com/in/someone-else" }, env, NOW);
    expect(retried).toMatchObject({ applicationId: first.applicationId, status: "run-started", duplicate: true, note: null });
    expect(retried.runId).not.toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    expect(investigations[0]).toMatchObject({ profile_url: PROFILE, via: "intake", application_id: first.applicationId });
    expect(apps.get(first.applicationId)).toMatchObject({ status: "run-started", run_id: retried.runId, note: null });
  });

  it("capped when the intake runs of the last hour reach INTAKE_PER_HOUR_CAP", async () => {
    const { env, create } = makeEnv({ intakeRunsLastHour: 3, cap: "3" });
    const res = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);
    expect(res).toMatchObject({ status: "capped", runId: null });
    expect(create).not.toHaveBeenCalled();
  });

  it("the cap defaults to 10", async () => {
    expect((await ingestApplication({ ...base, linkedinUrl: PROFILE }, makeEnv({ intakeRunsLastHour: 9 }).env, NOW)).status).toBe("run-started");
    expect((await ingestApplication({ ...base, linkedinUrl: PROFILE }, makeEnv({ intakeRunsLastHour: 10 }).env, NOW)).status).toBe("capped");
  });

  it("an R2 failure propagates and leaves the row at received", async () => {
    const { env, apps, create } = makeEnv({ r2Error: new Error("R2 down") });
    const cv = { bytes: tinyPdf("Kubernetes"), filename: "cv.pdf", contentType: "application/pdf" };
    await expect(ingestApplication({ ...base, cv }, env, NOW)).rejects.toThrow("R2 down");
    expect([...apps.values()][0]).toMatchObject({ status: "received" });
    expect([...apps.values()][0]?.note).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects invalid input before touching D1", async () => {
    const { env, apps } = makeEnv();
    await expect(ingestApplication({ ...base, source: "fax" } as never, env, NOW)).rejects.toThrow();
    expect(apps.size).toBe(0);
  });
});
