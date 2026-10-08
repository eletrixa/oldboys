/**
 * Tests for the Google Forms intake handler (POST /api/intake/form) with hand-written D1, R2 and Workflow fakes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/intake/__tests__/form.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover specs/intake/form.md: 503/401/400 rejections, LinkedIn-only and CV application, duplicate, no runId leak
 *
 * Design constraints:
 * - No module mocks; fakes match on SQL prefixes and keep state in plain maps
 */
import { describe, expect, it, vi } from "vitest";
import { tinyPdf } from "@/domain/__tests__/fixtures/tiny-pdf";
import { handleFormIntake, type FormIntakeEnv } from "../form/handler";

const NOW = new Date("2026-10-08T12:00:00.000Z");
const TOKEN = "intake-secret";
const PROFILE = "https://www.linkedin.com/in/josef-buryan";

type Row = Record<string, unknown>;

function makeEnv(opts: { token?: string; r2Error?: Error } = {}) {
  const tags = new Map<string, Row>([["senior-be", { role: "Senior backend engineer", goal: "hiring" }]]);
  const apps = new Map<string, Row>();
  const investigations: Row[] = [];
  const puts: { key: string; bytes: number[]; contentType: string | undefined }[] = [];
  const create = vi.fn((_: unknown) => Promise.resolve({ id: "wf" }));

  const exec = (sql: string, args: unknown[]): { rows: Row[]; changes: number } => {
    if (sql.startsWith("SELECT id, status, run_id, note, tag, linkedin_url, cv_text FROM applications")) {
      const hit = [...apps.values()].find((a) => a.source === args[0] && a.external_id === args[1]);
      return { rows: hit ? [hit] : [], changes: 0 };
    }
    if (sql.startsWith("INSERT INTO applications")) {
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
    if (sql.startsWith("SELECT COUNT(*) AS n FROM investigations")) return { rows: [{ n: 0 }], changes: 0 };
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
    SOURCES: {
      put: (key: string, bytes: ArrayBuffer, o?: { httpMetadata?: { contentType?: string } }) => {
        if (opts.r2Error) return Promise.reject(opts.r2Error);
        puts.push({ key, bytes: [...new Uint8Array(bytes)], contentType: o?.httpMetadata?.contentType });
        return Promise.resolve(null);
      },
    },
    INTAKE_TOKEN: "token" in opts ? opts.token : TOKEN,
  } as unknown as FormIntakeEnv;
  return { env, apps, investigations, puts, create };
}

function post(body: unknown, token: string | null = TOKEN): Request {
  return new Request("https://x.test/api/intake/form", {
    method: "POST",
    headers: token === null ? {} : { Authorization: `Bearer ${token}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const base = { tag: "senior-be", externalId: "resp-1", name: "Josef Buryan", email: "josef@mail.test" };

describe("handleFormIntake", () => {
  it("503 without INTAKE_TOKEN, naming the secret", async () => {
    const { env } = makeEnv({ token: "" });
    const res = await handleFormIntake(post({ ...base, linkedinUrl: PROFILE }), env, NOW);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "INTAKE_TOKEN secret is not configured" });
  });

  it("401 on a wrong or missing bearer; RUN_TOKEN is not accepted", async () => {
    const { env } = makeEnv();
    const body = { ...base, linkedinUrl: PROFILE };
    expect((await handleFormIntake(post(body, "wrong"), env, NOW)).status).toBe(401);
    expect((await handleFormIntake(post(body, null), env, NOW)).status).toBe(401);
    const withRunToken = { ...env, RUN_TOKEN: "run-secret" } as FormIntakeEnv;
    expect((await handleFormIntake(post(body, "run-secret"), withRunToken, NOW)).status).toBe(401);
  });

  it("400 on invalid JSON", async () => {
    const { env } = makeEnv();
    const res = await handleFormIntake(post("not json"), env, NOW);
    expect(res.status).toBe(400);
  });

  it("400 when no linkedinUrl, cvText or cvBase64 is sent, and writes nothing", async () => {
    const { env, apps } = makeEnv();
    const res = await handleFormIntake(post(base), env, NOW);
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("send linkedinUrl, cvText or cvBase64");
    expect(apps.size).toBe(0);
  });

  it("400 on bad base64, and writes nothing", async () => {
    const { env, apps, puts } = makeEnv();
    const res = await handleFormIntake(post({ ...base, cvBase64: "not base64!" }), env, NOW);
    expect(res.status).toBe(400);
    expect(apps.size).toBe(0);
    expect(puts).toHaveLength(0);
  });

  it("201 with a LinkedIn URL only: one application, one run, no runId in the answer", async () => {
    const { env, apps, investigations, create } = makeEnv();
    const res = await handleFormIntake(post({ ...base, linkedinUrl: "cz.linkedin.com/in/Josef-Buryan?trk=x" }), env, NOW);

    expect(res.status).toBe(201);
    const json = await res.json<Record<string, unknown>>();
    expect(json).toEqual({ applicationId: expect.any(String) as string, status: "run-started" });
    expect(apps.get(json.applicationId as string)).toMatchObject({
      source: "form",
      external_id: "resp-1",
      tag: "senior-be",
      status: "run-started",
      linkedin_url: PROFILE,
      run_id: investigations[0]?.id,
    });
    expect(investigations).toHaveLength(1);
    expect(investigations[0]).toMatchObject({ via: "intake", profile_url: PROFILE, role: "Senior backend engineer" });
    expect(create).toHaveBeenCalledOnce();
  });

  it("201 with cvBase64: the decoded bytes go to R2 and the extracted text starts the run", async () => {
    const { env, puts, investigations } = makeEnv();
    const pdf = tinyPdf("Josef Buryan Kubernetes");
    const res = await handleFormIntake(
      post({ ...base, cvBase64: Buffer.from(pdf).toString("base64"), cvFilename: "Josef CV.pdf" }),
      env,
      NOW,
    );

    expect(res.status).toBe(201);
    const json = await res.json<{ applicationId: string }>();
    expect(puts).toEqual([
      { key: `intake/${json.applicationId}/Josef_CV.pdf`, bytes: [...new Uint8Array(pdf)], contentType: "application/pdf" },
    ]);
    expect(investigations[0]).toMatchObject({ cv_text: "Josef Buryan Kubernetes", profile_url: null });
  });

  it("200 duplicate for a repeated externalId: same application, one run, no runId", async () => {
    const { env, investigations, create } = makeEnv();
    const first = await (await handleFormIntake(post({ ...base, linkedinUrl: PROFILE }), env, NOW)).json<{ applicationId: string }>();
    const res = await handleFormIntake(post({ ...base, linkedinUrl: PROFILE }), env, NOW);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applicationId: first.applicationId, status: "run-started", duplicate: true });
    expect(investigations).toHaveLength(1);
    expect(create).toHaveBeenCalledOnce();
  });

  it("201 unmatched for an unknown tag: stored, no run", async () => {
    const { env, apps, investigations } = makeEnv();
    const res = await handleFormIntake(post({ ...base, tag: "no-such-tag", linkedinUrl: PROFILE }), env, NOW);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ applicationId: expect.any(String) as string, status: "unmatched" });
    expect([...apps.values()][0]).toMatchObject({ status: "unmatched", run_id: null });
    expect(investigations).toHaveLength(0);
  });

  it("500 JSON without internals when the funnel throws", async () => {
    const { env } = makeEnv({ r2Error: new Error("R2 down: secret detail") });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await handleFormIntake(post({ ...base, cvBase64: Buffer.from(tinyPdf("x")).toString("base64") }), env, NOW);
    error.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "intake failed" });
  });
});
