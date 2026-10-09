/**
 * Tests for the hosted apply page handler (handleApply) with hand-written D1, R2 and Workflow fakes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/apply/__tests__/apply.test.ts
 * Deps:    vitest, src/workflow/__tests__/fixtures/intake-fakes, src/domain/__tests__/fixtures (tiny-pdf, tiny-docx)
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover origin 403, honeypot silent drop, validation 400s (Czech with ?lang=cs), LinkedIn-only, PDF, DOCX, TXT, older
 *   .doc beside LinkedIn and pasted-text applications, a scan without text (400 alone, 201 beside LinkedIn),
 *   file-wins-over-text, duplicate, unmatched and capped answering 201 like any other, a funnel failure 500 and its
 *   retry storing the CV, an in-flight duplicate 503
 * - Prove no response ever carries an application id, status or run id
 *
 * Design constraints:
 * - No module mocks; multipart Requests are built with FormData + File under Node
 * - The shared D1 fake matches on SQL prefixes and keeps state in plain maps
 */
import { describe, expect, it, vi } from "vitest";
import { COPY } from "@/app/apply/[tag]/apply-copy";
import { MESSAGES } from "@/app/apply/[tag]/apply-fields";
import { CV_MAX } from "@/domain/application";
import { tinyDocx } from "@/domain/__tests__/fixtures/tiny-docx";
import { tinyPdf } from "@/domain/__tests__/fixtures/tiny-pdf";
import { CV_MEDIA_TYPE } from "@/domain/cv-kind";
import { makeIntakeFakes } from "@/workflow/__tests__/fixtures/intake-fakes";
import { handleApply } from "../handler";

const NOW = new Date("2026-10-09T12:00:00.000Z");
const URL_ = "https://oldboys.test/api/apply";
const SAME_ORIGIN = { Origin: "https://oldboys.test", Host: "oldboys.test", "Sec-Fetch-Site": "same-origin" };

function makeEnv(opts: { intakeRunsLastHour?: number; cap?: string; r2Error?: Error } = {}) {
  return makeIntakeFakes(opts);
}

const FIELDS: Record<string, string | File> = {
  tag: "senior-be",
  name: "Josef Buryan",
  email: "Josef@Mail.test",
  linkedinUrl: "https://www.linkedin.com/in/josef-buryan",
  coverLetter: "Hello",
  website: "",
};

function post(fields: Record<string, string | File | undefined> = {}, headers: Record<string, string> = SAME_ORIGIN, url = URL_): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...FIELDS, ...fields })) if (v !== undefined) form.set(k, v);
  return new Request(url, { method: "POST", headers, body: form });
}

/** The `error` string of a JSON error response; fails the test when the body has any other shape. */
async function errorOf(res: Response): Promise<string> {
  const body = await res.json<Record<string, unknown>>();
  expect(Object.keys(body)).toEqual(["error"]);
  return String(body.error);
}

const pdfFile = (name = "cv.pdf", type = "application/pdf"): File => new File([tinyPdf("Josef Buryan Kubernetes")], name, { type });
const scanFile = (): File => new File([tinyPdf(null)], "scan.pdf", { type: "application/pdf" });
const docFile = (): File => new File(["\xd0\xcf\x11\xe0 old word"], "cv-2012.doc", { type: "application/msword" });
const docxFile = (name = "jana-cv.docx", type: string = CV_MEDIA_TYPE.docx): File => new File([tinyDocx(["Jana Novak", "Rust engineer"])], name, { type });

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
    ["old Word .doc CV", { linkedinUrl: "", cv: new File(["x"], "cv.doc", { type: "application/msword" }) }],
    ["image CV", { cv: new File(["x"], "cv.png", { type: "image/png" }) }],
    ["blank pasted CV and no LinkedIn", { linkedinUrl: "", cvText: "   " }],
    ["pasted CV over 20000 characters", { linkedinUrl: "", cvText: "x".repeat(CV_MAX + 1) }],
    ["CV over 10 MiB", { cv: new File([new Uint8Array(10 * 1024 * 1024 + 1)], "cv.pdf", { type: "application/pdf" }) }],
    ["message over 10000 characters", { coverLetter: "x".repeat(10_001) }],
  ])("answers 400 with an error and stores nothing: %s", async (_label, fields) => {
    const { env, writes } = makeEnv();
    const res = await handleApply(post(fields), env, NOW);
    expect(res.status).toBe(400);
    expect(await errorOf(res)).not.toBe("");
    expect(writes).toEqual([]);
  });

  it("answers 400 with the formats sentence for a file it cannot read", async () => {
    const { env } = makeEnv();
    const res = await handleApply(post({ linkedinUrl: "", cv: new File(["x"], "scan.jpg", { type: "image/jpeg" }) }), env, NOW);
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe(MESSAGES.cvType);
  });

  it("answers 400 in Czech when the page asked for Czech", async () => {
    const { env } = makeEnv();
    const res = await handleApply(post({ name: "" }, SAME_ORIGIN, `${URL_}?lang=cs`), env, NOW);
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe(COPY.cs.messages.name);
  });

  it("answers 400 to an older .doc without LinkedIn, saying why", async () => {
    const { env, writes } = makeEnv();
    const res = await handleApply(post({ linkedinUrl: "", cv: docFile() }), env, NOW);
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe(MESSAGES.cvDoc);
    expect(writes).toEqual([]);
  });

  it("an older .doc beside LinkedIn is stored as Word 97-2003 and the run starts from the profile", async () => {
    const { env, puts, investigations, apps } = makeEnv();
    const res = await handleApply(post({ cv: docFile() }), env, NOW);
    expect(res.status).toBe(201);
    expect(puts.map((p) => p.contentType)).toEqual(["application/msword"]);
    expect(investigations[0]).toMatchObject({ profile_url: "https://www.linkedin.com/in/josef-buryan", cv_text: null });
    expect([...apps.values()][0]?.note).toContain("old Word (.doc) file stored, not read");
  });

  it("a scanned PDF without text and no LinkedIn is a 400 the candidate can fix, nothing stored", async () => {
    const { env, writes } = makeEnv();
    const res = await handleApply(post({ linkedinUrl: "", cv: scanFile() }), env, NOW);
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("We could not read any text in that PDF. Please add your LinkedIn profile or paste the text of your CV.");
    expect(writes).toEqual([]);
  });

  it("a scanned PDF beside LinkedIn is stored and the run starts from the profile", async () => {
    const { env, puts, apps } = makeEnv();
    const res = await handleApply(post({ cv: scanFile() }), env, NOW);
    expect(res.status).toBe(201);
    expect(puts).toHaveLength(1);
    expect([...apps.values()][0]).toMatchObject({ status: "run-started" });
  });

  it("answers 400 before parsing when Content-Length is far over the CV limit", async () => {
    const { env } = makeEnv();
    const res = await handleApply(post({}, { ...SAME_ORIGIN, "Content-Length": String(11 * 1024 * 1024) }), env, NOW);
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

  it("DOCX application: the file lands in R2 as Word and its extracted text starts the run", async () => {
    const { env, puts, investigations, apps } = makeEnv();
    const res = await handleApply(post({ linkedinUrl: "", cv: docxFile() }), env, NOW);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ received: true });
    const id = [...apps.keys()][0];
    expect(puts.map((p) => [p.key, p.contentType])).toEqual([[`intake/${String(id)}/jana-cv.docx`, CV_MEDIA_TYPE.docx]]);
    expect(investigations[0]).toMatchObject({ cv_text: "Jana Novak Rust engineer", profile_url: null });
    expect([...apps.values()][0]).toMatchObject({ status: "run-started", cv_text: "Jana Novak Rust engineer" });
  });

  it("a DOCX sent without a media type is stored as Word, not as the PDF default, and still read", async () => {
    const { env, puts, investigations } = makeEnv();
    const res = await handleApply(post({ linkedinUrl: "", cv: docxFile("cv.docx", "") }), env, NOW);
    expect(res.status).toBe(201);
    expect(puts[0]?.contentType).toBe(CV_MEDIA_TYPE.docx);
    expect(investigations[0]).toMatchObject({ cv_text: "Jana Novak Rust engineer" });
  });

  it("TXT application: the text file starts the run", async () => {
    const { env, puts, investigations } = makeEnv();
    const res = await handleApply(post({ linkedinUrl: "", cv: new File(["Ten years of Go."], "cv.txt", { type: "text/plain" }) }), env, NOW);
    expect(res.status).toBe(201);
    expect(puts.map((p) => p.contentType)).toEqual(["text/plain"]);
    expect(investigations[0]).toMatchObject({ cv_text: "Ten years of Go." });
  });

  it("pasted CV text only: no file stored, the text starts the run", async () => {
    const { env, puts, investigations, apps } = makeEnv();
    const res = await handleApply(post({ linkedinUrl: "", cvText: "  Jana Novak, ten years of Rust.\n" }), env, NOW);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ received: true });
    expect(puts).toEqual([]);
    expect(investigations[0]).toMatchObject({ cv_text: "Jana Novak, ten years of Rust.", profile_url: null });
    expect([...apps.values()][0]).toMatchObject({ status: "run-started", cv_key: null });
  });

  it("a file and pasted text together: the file is stored and read, the text ignored", async () => {
    const { env, puts, investigations } = makeEnv();
    const res = await handleApply(post({ linkedinUrl: "", cv: pdfFile(), cvText: "pasted text that must not win" }), env, NOW);

    expect(res.status).toBe(201);
    expect(puts).toHaveLength(1);
    expect(investigations[0]).toMatchObject({ cv_text: "Josef Buryan Kubernetes" });
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

  it("a capped application is stored and answered 201 like any other: the queue starts its run later", async () => {
    const { env, apps, create } = makeEnv({ intakeRunsLastHour: 10 });
    const res = await handleApply(post({ linkedinUrl: "", cv: pdfFile() }), env, NOW);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ received: true });
    expect([...apps.values()][0]).toMatchObject({ status: "capped", cv_text: "Josef Buryan Kubernetes" });
    expect([...apps.values()][0]?.cv_key).not.toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect((await handleApply(post(), env, NOW)).status).toBe(201);
  });

  it("Try again after a failed send stores the CV and starts the run before it says received", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { env, apps, create, puts } = makeEnv();
    create.mockRejectedValueOnce(new Error("workflow down"));
    const first = await handleApply(post({ linkedinUrl: "", cv: pdfFile() }), env, NOW);
    expect(first.status).toBe(500);

    const retry = await handleApply(post({ linkedinUrl: "", cv: pdfFile() }), env, new Date(NOW.getTime() + 3_000));
    expect(retry.status).toBe(201);
    const row = [...apps.values()][0];
    expect(row).toMatchObject({ status: "run-started", cv_text: "Josef Buryan Kubernetes" });
    expect(row?.cv_key).not.toBeNull();
    expect(row?.run_id).not.toBeNull();
    expect(puts.length).toBeGreaterThan(0);
    expect(apps.size).toBe(1);
    spy.mockRestore();
  });

  it("answers 503 (try again), never received, while an earlier send of the same application is still being stored", async () => {
    const { env, apps } = makeEnv();
    await handleApply(post(), env, NOW);
    const row = [...apps.values()][0];
    // As if the first send were still running: the row is stored but not yet decided, and not marked failed.
    if (row) Object.assign(row, { status: "received", run_id: null, note: null });

    const res = await handleApply(post(), env, new Date(NOW.getTime() + 1_000));
    expect(res.status).toBe(503);
    expect(await errorOf(res)).toBe(MESSAGES.server);
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
