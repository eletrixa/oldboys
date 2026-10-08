/**
 * Tests for the Worker email handler: recipient gate, size gate, funnel call, forward copy and its failure modes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/intake-email.test.ts
 * Deps:    vitest, src/domain/__tests__/fixtures/*.eml
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover specs/intake/email.md: wrong recipient, oversize, happy path, forward failure, sender allow-list,
 *   no-tag mail, duplicate delivery, funnel error still forwarded and rethrown
 *
 * Design constraints:
 * - No module mocks: a fake ForwardableEmailMessage and hand-written D1/R2/Workflow fakes keyed on SQL prefixes
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { handleIntakeEmail, type IntakeEmailEnv } from "../intake-email";

const NOW = new Date("2026-10-08T12:00:00.000Z");

type Row = Record<string, unknown>;

function fakeMessage(fixture: string, opts: { to?: string; from?: string; rawSize?: number; forwardError?: Error } = {}) {
  const bytes = readFileSync(new URL(`../../domain/__tests__/fixtures/${fixture}`, import.meta.url));
  const setReject = vi.fn((_reason: string) => undefined);
  const forward = vi.fn((_to: string) => (opts.forwardError ? Promise.reject(opts.forwardError) : Promise.resolve({ messageId: "fwd" })));
  const message = {
    from: opts.from ?? "candidate@example.net",
    to: opts.to ?? "jobs+senior-be@asajj.cz",
    rawSize: opts.rawSize ?? bytes.byteLength,
    raw: new Blob([bytes]).stream(),
    headers: new Headers(),
    setReject,
    forward,
  } as unknown as ForwardableEmailMessage;
  return { message, setReject, forward };
}

function makeEnv(vars: { forwardTo?: string; allow?: string; dbError?: Error } = {}) {
  const apps = new Map<string, Row>();
  const investigations: Row[] = [];
  const puts: string[] = [];
  const exec = (sql: string, args: unknown[]): { rows: Row[]; changes: number } => {
    if (vars.dbError) throw vars.dbError;
    if (sql.startsWith("SELECT id, status, run_id, note FROM applications")) {
      const hit = [...apps.values()].find((a) => a.source === args[0] && a.external_id === args[1]);
      return { rows: hit ? [hit] : [], changes: 0 };
    }
    if (sql.startsWith("INSERT INTO applications")) {
      const cols = /\(([^)]*)\)/.exec(sql)?.[1]?.split(", ") ?? [];
      const row: Row = Object.fromEntries(cols.map((c, i) => [c, args[i]]));
      apps.set(row.id as string, { ...row, status: "received" });
      return { rows: [], changes: 1 };
    }
    if (sql.startsWith("SELECT role, goal FROM intake_tags WHERE tag = ?")) {
      return { rows: args[0] === "senior-be" ? [{ role: "Senior backend engineer", goal: "hiring" }] : [], changes: 0 };
    }
    if (sql.startsWith("SELECT COUNT(*) AS n FROM investigations")) return { rows: [{ n: 0 }], changes: 0 };
    if (sql.startsWith("INSERT INTO investigations")) {
      investigations.push({ id: args[0] });
      return { rows: [], changes: 1 };
    }
    const update = /^UPDATE applications SET (.*) WHERE id = \?$/.exec(sql);
    if (update) {
      const cols = (update[1] ?? "").split(", ").map((c) => c.split(" = ")[0] ?? "");
      const row = apps.get(args[cols.length] as string);
      cols.forEach((c, i) => row && (row[c] = args[i]));
      return { rows: [], changes: row ? 1 : 0 };
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
    RESEARCH_RUN: { create: () => Promise.resolve({ id: "wf" }) },
    RUN_BUDGET_USD: "0.50",
    RUN_BUDGET_CALLS: "16",
    SOURCES: {
      put: (key: string) => {
        puts.push(key);
        return Promise.resolve(null);
      },
    },
    INTAKE_FORWARD_TO: vars.forwardTo ?? "robert@example.cz",
    INTAKE_FROM_ALLOW: vars.allow ?? "",
  } as unknown as IntakeEmailEnv;
  return { env, apps, investigations, puts };
}

describe("handleIntakeEmail", () => {
  it("rejects a catch-all recipient that is not jobs@ or jobs+<tag>@ and stores nothing", async () => {
    for (const to of ["info@asajj.cz", "jobsx+senior-be@asajj.cz", "postmaster@asajj.cz"]) {
      const { env, apps } = makeEnv();
      const { message, setReject, forward } = fakeMessage("gmail-forward.eml", { to });
      const log = vi.fn();
      await handleIntakeEmail(message, env, NOW, log);
      expect(setReject).toHaveBeenCalledWith("no such address");
      expect(forward).not.toHaveBeenCalled();
      expect(apps.size).toBe(0);
    }
  });

  it("rejects a message over 10 MiB before reading it", async () => {
    const { env, apps } = makeEnv();
    const { message, setReject, forward } = fakeMessage("gmail-forward.eml", { rawSize: 10 * 1024 * 1024 + 1 });
    await handleIntakeEmail(message, env, NOW, vi.fn());
    expect(setReject).toHaveBeenCalledWith("message too large");
    expect(forward).not.toHaveBeenCalled();
    expect(apps.size).toBe(0);
  });

  it("stores the application, starts the run, keeps the CV and forwards a copy", async () => {
    const { env, apps, investigations, puts } = makeEnv();
    const { message, setReject, forward } = fakeMessage("gmail-forward.eml");
    const log = vi.fn();
    await handleIntakeEmail(message, env, NOW, log);

    expect(setReject).not.toHaveBeenCalled();
    const [app] = [...apps.values()];
    expect(app).toMatchObject({
      source: "email",
      external_id: "<CAF0xGmailFwd0001@mail.example.net>",
      tag: "senior-be",
      name: "Marek Lindner",
      status: "run-started",
      linkedin_url: "https://www.linkedin.com/in/marek-lindner-test",
    });
    expect(investigations).toHaveLength(1);
    expect(puts).toEqual([`intake/${String(app?.id)}/Marek_Lindner_CV.pdf`]);
    expect(forward).toHaveBeenCalledWith("robert@example.cz");
    expect(log).toHaveBeenCalledWith(`intake email ${String(app?.id)} run-started`);
  });

  it("a forward failure is logged, never thrown, and the application stays stored", async () => {
    const { env, apps } = makeEnv();
    const { message } = fakeMessage("seznam-copy.eml", { forwardError: new Error("destination not verified") });
    const log = vi.fn();
    await expect(handleIntakeEmail(message, env, NOW, log)).resolves.toBeUndefined();
    expect([...apps.values()][0]?.status).toBe("run-started");
    expect(log).toHaveBeenCalledWith("intake email forward failed: destination not verified");
  });

  it("no forward when INTAKE_FORWARD_TO is empty", async () => {
    const { env } = makeEnv({ forwardTo: " " });
    const { message, forward } = fakeMessage("seznam-copy.eml");
    await handleIntakeEmail(message, env, NOW, vi.fn());
    expect(forward).not.toHaveBeenCalled();
  });

  it("an envelope sender outside INTAKE_FROM_ALLOW is unmatched and starts no run", async () => {
    const { env, apps, investigations } = makeEnv({ allow: "jobs.cz, robert@soulfire.cz" });
    const { message } = fakeMessage("gmail-forward.eml", { from: "someone@example.net" });
    await handleIntakeEmail(message, env, NOW, vi.fn());
    expect([...apps.values()][0]).toMatchObject({ status: "unmatched", note: expect.stringContaining("sender not allowed") as string });
    expect(investigations).toHaveLength(0);
  });

  it("a mail to plain jobs@ is stored as unmatched", async () => {
    const { env, apps } = makeEnv();
    const { message, setReject } = fakeMessage("no-tag.eml", { to: "jobs@asajj.cz" });
    await handleIntakeEmail(message, env, NOW, vi.fn());
    expect(setReject).not.toHaveBeenCalled();
    const [app] = [...apps.values()];
    expect(app).toMatchObject({ status: "unmatched", tag: null });
    expect(app?.external_id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("the same message delivered twice is one application and one run", async () => {
    const { env, apps, investigations } = makeEnv();
    await handleIntakeEmail(fakeMessage("gmail-forward.eml").message, env, NOW, vi.fn());
    await handleIntakeEmail(fakeMessage("gmail-forward.eml").message, env, NOW, vi.fn());
    expect(apps.size).toBe(1);
    expect(investigations).toHaveLength(1);
  });

  it("a funnel error is logged, the copy is still forwarded, then the error is rethrown", async () => {
    const { env } = makeEnv({ dbError: new Error("D1 down") });
    const { message, forward } = fakeMessage("gmail-forward.eml");
    const log = vi.fn();
    await expect(handleIntakeEmail(message, env, NOW, log)).rejects.toThrow("D1 down");
    expect(forward).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith("intake email failed: D1 down");
  });
});
