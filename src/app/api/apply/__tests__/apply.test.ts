/**
 * Tests for the hosted apply page handler (handleApply) with hand-written D1, R2 and Workflow fakes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/apply/__tests__/apply.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover origin 403, honeypot silent drop, validation 400s, LinkedIn-only and PDF applications, duplicate,
 *   unmatched and incomplete answering like any other, the hourly cap 429 and a funnel failure 500
 * - Prove no response ever carries an application id, status or run id
 *
 * Design constraints:
 * - No module mocks; multipart Requests are built with FormData + File under Node
 * - The D1 fake matches on SQL prefixes and keeps state in plain maps
 */
import { describe, expect, it, vi } from "vitest";
import { tinyPdf } from "@/domain/__tests__/fixtures/tiny-pdf";
import type { IntakeEnv } from "@/workflow/intake";
import { handleApply } from "../handler";

const NOW = new Date("2026-10-09T12:00:00.000Z");
const URL_ = "https://oldboys.test/api/apply";
const SAME_ORIGIN = { Origin: "https://oldboys.test", Host: "oldboys.test", "Sec-Fetch-Site": "same-origin" };

type Row = Record<string, unknown>;

function makeEnv(opts: { intakeRunsLastHour?: number; cap?: string; r2Error?: Error } = {}) {
  const tags = new Map<string, Row>([["senior-be", { role: "Senior backend engineer", goal: "hiring" }]]);
  const apps = new Map<string, Row>();
  const investigations: Row[] = [];
  const puts: { key: string; size: number; contentType: string | undefined }[] = [];
  const writes: string[] = [];
  const create = vi.fn((_: unknown) => Promise.resolve({ id: "wf" }));

  const exec = (sql: string, args: unknown[]): { rows: Row[]; changes: number } => {
    if (sql.startsWith("SELECT id, status, run_id, note, tag, linkedin_url, cv_text FROM applications")) {
      const hit = [...apps.values()].find((a) => a.source === args[0] && a.external_id === args[1]);
      return { rows: hit ? [hit] : [], changes: 0 };
    }
    if (sql.startsWith("INSERT INTO applications")) {
      writes.push(sql);
      const cols = /\(([^)]*)\)/.exec(sql)?.[1]?.split(", ") ?? [];
      const row: Row = Object.fromEntries(cols.map((c, i) => [c, args[i]]));
      row.status = "received";
      apps.set(row.id as string, row);
      return { rows: [], changes: 1 };
    }
    if (sql.startsWith("SELECT role, goal FROM intake_tags WHERE tag = ?")) {
      const t = tags.get(args[0] as string);
      return { rows: t ? [t] : [], changes: 0 };
    }
    if (sql.startsWith("SELECT COUNT(*) AS n FROM investigations")) {
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
      writes.push(sql);
      const cols = (update[1] ?? "").split(", ").map((c) => c.split(" = ")[0] ?? "");
      const row = apps.get(args[cols.length] as string);
      cols.forEach((c, i) => {
        if (row) row[c] = args[i];
      });
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
  return { env, apps, investigations, puts, writes, create };
}

const FIELDS: Record<string, string | File> = {
  tag: "senior-be",
  name: "Josef Buryan",
  email: "Josef@Mail.test",
  linkedinUrl: "https://www.linkedin.com/in/josef-buryan",
  coverLetter: "Hello",
  website: "",
};

function post(fields: Record<string, string | File | undefined> = {}, headers: Record<string, string> = SAME_ORIGIN): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...FIELDS, ...fields })) if (v !== undefined) form.set(k, v);
  return new Request(URL_, { method: "POST", headers, body: form });
}

/** The `error` string of a JSON error response; fails the test when the body has any other shape. */
async function errorOf(res: Response): Promise<string> {
  const body = await res.json<Record<string, unknown>>();
  expect(Object.keys(body)).toEqual(["error"]);
  return String(body.error);
}

const pdfFile = (name = "cv.pdf", type = "application/pdf"): File => new File([tinyPdf("Josef Buryan Kubernetes")], name, { type });

describe("handleApply", () => {
  it("rejects a request that does not come from our page with 403", async () => {
    const { env, writes } = makeEnv();
    for (const headers of [{}, { ...SAME_ORIGIN, "Sec-Fetch-Site": "cross-site" }, { ...SAME_ORIGIN, Origin: "https://evil.test" }]) {
      const res = await handleApply(post({}, headers), env, NOW);
      expect(res.status).toBe(403);
      expect(await errorOf(res)).not.toBe("");
    }
    expect(writes).toEqual([]);
  });

  it("answers 400 to a body that is not multipart form data", async () => {
    const { env } = makeEnv();
    const res = await handleApply(new Request(URL_, { method: "POST", headers: { ...SAME_ORIGIN, "Content-Type": "application/json" }, body: "{}" }), env, NOW);
    expect(res.status).toBe(400);
  });

  it("drops a filled honeypot silently: 200 received, nothing stored", async () => {
    const { env, writes, apps, create } = makeEnv();
    const res = await handleApply(post({ website: "https://spam.test" }), env, NOW);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(writes).toEqual([]);
    expect(apps.size).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ["bad tag", { tag: "Not A Tag!" }],
    ["missing tag", { tag: undefined }],
    ["missing name", { name: undefined }],
    ["blank name", { name: "   " }],
    ["bad email", { email: "nope" }],
    ["neither LinkedIn nor CV", { linkedinUrl: "" }],
    ["not a LinkedIn link", { linkedinUrl: "https://example.com/in/x" }],
    ["non-PDF CV", { linkedinUrl: "", cv: pdfFile("cv.docx", "application/msword") }],
    ["CV over 5 MiB", { cv: new File([new Uint8Array(5 * 1024 * 1024 + 1)], "cv.pdf", { type: "application/pdf" }) }],
    ["message over 10000 characters", { coverLetter: "x".repeat(10_001) }],
  ])("answers 400 with an error and stores nothing: %s", async (_label, fields) => {
    const { env, writes } = makeEnv();
    const res = await handleApply(post(fields), env, NOW);
    expect(res.status).toBe(400);
    expect(await errorOf(res)).not.toBe("");
    expect(writes).toEqual([]);
  });

  it("answers 400 before parsing when Content-Length is far over the CV limit", async () => {
    const { env } = makeEnv();
    const res = await handleApply(post({}, { ...SAME_ORIGIN, "Content-Length": String(6 * 1024 * 1024) }), env, NOW);
    expect(res.status).toBe(400);
  });

  it("LinkedIn-only application: 201 {received:true}, run started for the tag's role", async () => {
    const { env, apps, investigations, create } = makeEnv();
    const res = await handleApply(post(), env, NOW);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ received: true });
    expect(create).toHaveBeenCalledOnce();
    expect(investigations[0]).toMatchObject({ via: "intake", role: "Senior backend engineer", profile_url: "https://www.linkedin.com/in/josef-buryan" });
    expect([...apps.values()][0]).toMatchObject({
      source: "apply-page",
      tag: "senior-be",
      name: "Josef Buryan",
      email: "Josef@Mail.test",
      cover_letter: "Hello",
      status: "run-started",
    });
  });

  it("PDF application: the file lands in R2 and its text starts the run", async () => {
    const { env, puts, investigations, apps } = makeEnv();
    const res = await handleApply(post({ linkedinUrl: "", cv: pdfFile("My CV.pdf") }), env, NOW);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ received: true });
    const id = [...apps.keys()][0];
    expect(puts.map((p) => [p.key, p.contentType])).toEqual([[`intake/${String(id)}/My_CV.pdf`, "application/pdf"]]);
    expect(investigations[0]).toMatchObject({ cv_text: "Josef Buryan Kubernetes", profile_url: null });
  });

  it("a PDF sent without a media type is accepted by its .pdf name", async () => {
    const { env, puts } = makeEnv();
    const res = await handleApply(post({ linkedinUrl: "", cv: pdfFile("cv.pdf", "") }), env, NOW);
    expect(res.status).toBe(201);
    expect(puts).toHaveLength(1);
  });

  it("a resubmit for the same position and email (any case) is a duplicate: 201 {received:true} like a first one, no second run", async () => {
    const { env, apps, create } = makeEnv();
    await handleApply(post(), env, NOW);
    const again = await handleApply(post({ email: "josef@mail.TEST" }), env, NOW);

    expect(again.status).toBe(201);
    expect(await again.json()).toEqual({ received: true });
    expect(apps.size).toBe(1);
    expect(create).toHaveBeenCalledOnce();
  });

  it("the same email applying to another position is a new application", async () => {
    const { env, apps } = makeEnv();
    await handleApply(post(), env, NOW);
    await handleApply(post({ tag: "other-role" }), env, NOW);
    expect(apps.size).toBe(2);
  });

  it("an unknown tag is stored as unmatched but answered like a success", async () => {
    const { env, apps, create } = makeEnv();
    const res = await handleApply(post({ tag: "nosuchtag" }), env, NOW);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ received: true });
    expect([...apps.values()][0]).toMatchObject({ status: "unmatched" });
    expect(create).not.toHaveBeenCalled();
  });

  it("answers 429 only when the hourly intake cap is reached, still storing the application", async () => {
    const { env, apps, create } = makeEnv({ intakeRunsLastHour: 10 });
    const res = await handleApply(post(), env, NOW);

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "too many applications" });
    expect([...apps.values()][0]).toMatchObject({ status: "capped" });
    expect(create).not.toHaveBeenCalled();
  });

  it("a resubmit of a capped application is answered 429 again, never as received", async () => {
    const { env } = makeEnv({ intakeRunsLastHour: 10 });
    await handleApply(post(), env, NOW);
    expect((await handleApply(post(), env, NOW)).status).toBe(429);
  });

  it("never leaks an application id, status or run id in any success response", async () => {
    const { env } = makeEnv();
    const bodies = await Promise.all(
      [post(), post(), post({ tag: "nosuchtag", email: "b@mail.test" }), post({ website: "x" })].map(async (r) => (await handleApply(r, env, NOW)).text()),
    );
    for (const body of bodies) expect(body).toBe('{"received":true}');
  });

  it("answers 500 with a plain message when the funnel fails, without internal detail", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { env } = makeEnv({ r2Error: new Error("R2 exploded secret-detail") });
    const res = await handleApply(post({ linkedinUrl: "", cv: pdfFile() }), env, NOW);

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("secret-detail");
    expect(Object.keys(JSON.parse(text) as object)).toEqual(["error"]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
