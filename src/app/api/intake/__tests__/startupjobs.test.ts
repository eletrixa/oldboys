/**
 * Tests for the StartupJobs webhook handler with hand-written D1, R2 and Workflow fakes and an injected fetch.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/intake/__tests__/startupjobs.test.ts
 * Deps:    vitest, src/workflow/__tests__/fixtures/intake-fakes
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover specs/intake/startupjobs.md: 503, 404, 422, test payload, happy path with a PDF, bearer on the first request
 *   (startupjobs.cz only), download failures, duplicate, unexpected throw answering 202 with an R2 dead letter
 *
 * Design constraints:
 * - No module mocks; the shared fakes match on SQL prefixes and keep state in plain maps
 */
import { describe, expect, it, vi } from "vitest";
import { tinyPdf } from "@/domain/__tests__/fixtures/tiny-pdf";
import { makeIntakeFakes } from "@/workflow/__tests__/fixtures/intake-fakes";
import { handleStartupJobsWebhook, type StartupJobsEnv } from "../startupjobs/handler";

const NOW = new Date("2026-10-09T10:00:00.000Z");
const TOKEN = "whtoken-123";
const PDF_URL = "https://www.startupjobs.cz/download/cv.pdf";

function makeEnv(opts: { secret?: string | null; bearer?: string; r2Error?: Error; dbError?: Error } = {}) {
  const fakes = makeIntakeFakes({ offerTags: { "1234": "senior-be" }, r2Error: opts.r2Error, dbError: opts.dbError });
  const env = {
    ...fakes.env,
    STARTUPJOBS_WEBHOOK_TOKEN: opts.secret === null ? undefined : (opts.secret ?? TOKEN),
    STARTUPJOBS_TOKEN: opts.bearer,
  } as StartupJobsEnv;
  return { ...fakes, env };
}

const payload = {
  date: "2026-10-09T10:00:00+02:00",
  candidateID: 12345,
  offerID: 1234,
  name: "Pan Žralok",
  position: "Senior Backend Engineer",
  why: "<p>Hello &amp; welcome</p>",
  phone: "+420 123 456 789",
  email: "dev@startupjobs.cz",
  linkedin: "",
  internalPositionName: "other-tag",
  files: [PDF_URL],
  gdpr_accepted: true,
};

const post = (body: unknown) => new Request("https://w.test/x", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const pdfResponse = () => new Response(tinyPdf("Pan Zralok Kubernetes"), { status: 200, headers: { "content-type": "application/pdf" } });
const fetchOf = (...responses: (Response | Error)[]) => {
  const queue = [...responses];
  return vi.fn((_url: string | URL | Request, _init?: RequestInit) => {
    const next = queue.shift();
    if (next === undefined) throw new Error("unexpected fetch");
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
};
const noFetch = () => fetchOf();

describe("handleStartupJobsWebhook: gate", () => {
  it("answers 503 when the webhook token is not configured", async () => {
    const { env } = makeEnv({ secret: null });
    const res = await handleStartupJobsWebhook(post(payload), TOKEN, env, NOW, noFetch());
    expect(res.status).toBe(503);
  });

  it("answers 404 for a wrong or empty token and touches nothing", async () => {
    const { env, apps } = makeEnv();
    const fetchImpl = noFetch();
    expect((await handleStartupJobsWebhook(post(payload), "nope", env, NOW, fetchImpl)).status).toBe(404);
    expect((await handleStartupJobsWebhook(post(payload), "", env, NOW, fetchImpl)).status).toBe(404);
    expect(apps.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers 422 for a body that is not JSON or not a StartupJobs payload", async () => {
    const { env, apps } = makeEnv();
    for (const body of ["{nope", JSON.stringify({ name: "x" }), JSON.stringify([1]), "null"]) {
      const res = await handleStartupJobsWebhook(post(body), TOKEN, env, NOW, noFetch());
      expect(res.status).toBe(422);
      expect(await res.json()).toHaveProperty("error");
    }
    expect(apps.size).toBe(0);
  });
});

describe("handleStartupJobsWebhook: ingest", () => {
  it("a test payload lands unmatched with the test note, downloads nothing and starts no run", async () => {
    const { env, apps, create } = makeEnv();
    const fetchImpl = noFetch();
    const res = await handleStartupJobsWebhook(post({ ...payload, test: true }), TOKEN, env, NOW, fetchImpl);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, test: true });
    expect([...apps.values()]).toMatchObject([{ source: "startupjobs", tag: null, status: "unmatched", note: "unknown tag; StartupJobs test payload" }]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("maps the offer id to a tag, stores the downloaded PDF and starts the run", async () => {
    const { env, apps, puts, investigations } = makeEnv();
    const fetchImpl = fetchOf(pdfResponse());
    const res = await handleStartupJobsWebhook(post(payload), TOKEN, env, NOW, fetchImpl);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(PDF_URL);
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
    const app = [...apps.values()][0];
    expect(app).toMatchObject({
      external_id: "1234:12345",
      tag: "senior-be",
      name: "Pan Žralok",
      email: "dev@startupjobs.cz",
      cover_letter: "Hello & welcome",
      status: "run-started",
      cv_text: "Pan Zralok Kubernetes",
      note: "startupjobs offer 1234 Senior Backend Engineer",
    });
    expect(puts).toHaveLength(1);
    expect(puts[0]?.key).toBe(`intake/${app?.id as string}/cv.pdf`);
    expect(investigations[0]).toMatchObject({ via: "intake", role: "Senior backend engineer", cv_text: "Pan Zralok Kubernetes" });
  });

  it("falls back to the internal position name when no offer mapping exists", async () => {
    const { env, apps } = makeEnv();
    await handleStartupJobsWebhook(post({ ...payload, offerID: 999, internalPositionName: "Senior-BE", files: [] }), TOKEN, env, NOW, noFetch());
    expect([...apps.values()][0]).toMatchObject({ tag: "senior-be", status: "incomplete" });
  });

  it("picks the first .pdf entry, case-insensitive, ignoring a query string", async () => {
    const { env, puts } = makeEnv();
    const fetchImpl = fetchOf(pdfResponse());
    const files = ["https://www.startupjobs.cz/download/photo.png", "https://cdn.test/files/My%20CV.PDF?sig=abc", PDF_URL];
    await handleStartupJobsWebhook(post({ ...payload, files }), TOKEN, env, NOW, fetchImpl);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(files[1]);
    expect(puts[0]?.key).toMatch(/\/My_CV\.PDF$/);
  });

  it("answers a repeated delivery with 200 and starts no second run", async () => {
    const { env, apps, create } = makeEnv();
    await handleStartupJobsWebhook(post(payload), TOKEN, env, NOW, fetchOf(pdfResponse()));
    const again = await handleStartupJobsWebhook(post(payload), TOKEN, env, NOW, fetchOf(pdfResponse()));
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ received: true });
    expect(apps.size).toBe(1);
    expect(create).toHaveBeenCalledOnce();
  });
});

describe("handleStartupJobsWebhook: CV download", () => {
  it("sends the StartupJobs bearer on the first request to a startupjobs.cz host, with no retry", async () => {
    const { env, apps } = makeEnv({ bearer: "sj-secret" });
    const fetchImpl = fetchOf(pdfResponse());
    const res = await handleStartupJobsWebhook(post(payload), TOKEN, env, NOW, fetchImpl);

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer sj-secret");
    expect([...apps.values()][0]).toMatchObject({ status: "run-started", cv_text: "Pan Zralok Kubernetes" });
  });

  it("does not retry after a 403 and records the status", async () => {
    const { env, apps } = makeEnv({ bearer: "sj-secret" });
    const fetchImpl = fetchOf(new Response("no", { status: 403 }));
    const res = await handleStartupJobsWebhook(post(payload), TOKEN, env, NOW, fetchImpl);

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect([...apps.values()][0]).toMatchObject({ status: "incomplete" });
    expect([...apps.values()][0]?.note).toContain("cv download failed 403");
  });

  it("never sends the bearer to a host outside startupjobs.cz", async () => {
    const { env } = makeEnv({ bearer: "sj-secret" });
    const fetchImpl = fetchOf(new Response("no", { status: 401 }));
    await handleStartupJobsWebhook(post({ ...payload, files: ["https://evil.test/cv.pdf"] }), TOKEN, env, NOW, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).has("authorization")).toBe(false);
  });

  it("keeps the application when the download fails: incomplete, or run-started with a LinkedIn URL", async () => {
    const a = makeEnv();
    const res = await handleStartupJobsWebhook(post(payload), TOKEN, a.env, NOW, fetchOf(new Error("boom")));
    expect(res.status).toBe(200);
    expect([...a.apps.values()][0]).toMatchObject({ status: "incomplete" });
    expect([...a.apps.values()][0]?.note).toContain("cv download failed");

    const b = makeEnv();
    const withProfile = { ...payload, linkedin: "https://linkedin.com/in/pan-zralok" };
    await handleStartupJobsWebhook(post(withProfile), TOKEN, b.env, NOW, fetchOf(new Response("gone", { status: 404 })));
    expect([...b.apps.values()][0]).toMatchObject({ status: "run-started", linkedin_url: "https://www.linkedin.com/in/pan-zralok" });
  });

  it("refuses a non-https URL and a file over 10 MiB without storing anything", async () => {
    const { env, puts, apps } = makeEnv();
    const plain = noFetch();
    await handleStartupJobsWebhook(post({ ...payload, candidateID: 1, files: ["http://www.startupjobs.cz/cv.pdf"] }), TOKEN, env, NOW, plain);
    expect(plain).not.toHaveBeenCalled();

    const big = fetchOf(new Response(new ArrayBuffer(8), { status: 200, headers: { "content-length": String(11 * 1024 * 1024) } }));
    await handleStartupJobsWebhook(post({ ...payload, candidateID: 2 }), TOKEN, env, NOW, big);
    expect(puts).toHaveLength(0);
    expect([...apps.values()].every((a) => String(a.note).includes("cv download failed"))).toBe(true);
  });

  it("notes when the payload has files but no PDF", async () => {
    const { env, apps } = makeEnv();
    await handleStartupJobsWebhook(post({ ...payload, files: ["https://www.startupjobs.cz/download/cv.docx"] }), TOKEN, env, NOW, noFetch());
    expect([...apps.values()][0]?.note).toContain("no PDF among 1 file");
  });
});

describe("handleStartupJobsWebhook: failures never delete the webhook", () => {
  it("answers 202, logs and keeps the raw payload in R2 when the funnel throws", async () => {
    const { env, puts } = makeEnv({ dbError: new Error("D1 down") });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await handleStartupJobsWebhook(post(payload), TOKEN, env, NOW, fetchOf(pdfResponse()));

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ received: false });
    expect(error.mock.calls[0]?.[0]).toBe("startupjobs webhook failed:");
    expect(puts.map((p) => ({ key: p.key, contentType: p.contentType, body: new TextDecoder().decode(p.bytes) }))).toEqual([
      { key: "intake/dead-letter/startupjobs/2026-10-09T10:00:00.000Z-12345.json", contentType: "application/json", body: JSON.stringify(payload) },
    ]);
    error.mockRestore();
  });

  it("still answers 202 when the dead letter cannot be written either", async () => {
    const { env, apps } = makeEnv({ r2Error: new Error("R2 down") });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await handleStartupJobsWebhook(post(payload), TOKEN, env, NOW, fetchOf(pdfResponse()));

    expect(res.status).toBe(202);
    expect(error.mock.calls.map((c) => String(c[0]))).toEqual(["startupjobs webhook failed:", "startupjobs webhook: dead letter failed:"]);
    expect([...apps.values()][0]).toMatchObject({ status: "received" });
    error.mockRestore();
  });
});
