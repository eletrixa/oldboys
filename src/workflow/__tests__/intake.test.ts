/**
 * Tests for the intake funnel (ingestApplication) on the shared D1, R2 and Workflow fakes (fixtures/intake-fakes).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/intake.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover specs/intake/funnel.md: happy path, CV-only PDF, duplicate and insert race, unknown tag, sender not
 *   allowed (no CV file stored for either), incomplete, capped (and the capped retry), R2 failure leaving the row
 *   at 'received' and its resume on the next delivery after the stale window (linking an already started run)
 *
 * Design constraints:
 * - No module mocks; the fakes match on SQL prefixes and keep state in plain maps
 */
import { describe, expect, it } from "vitest";
import { tinyPdf } from "@/domain/__tests__/fixtures/tiny-pdf";
import { ingestApplication, STALE_RECEIVED_MS } from "../intake";
import { makeIntakeFakes as makeEnv } from "./fixtures/intake-fakes";

const NOW = new Date("2026-10-08T12:00:00.000Z");
const PROFILE = "https://www.linkedin.com/in/josef-buryan";

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
    expect(puts.map((p) => ({ key: p.key, size: p.bytes.byteLength, contentType: p.contentType }))).toEqual([
      { key, size: cv.bytes.byteLength, contentType: "application/pdf" },
    ]);
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

  it("a capped retry keeps the stored parser and subject notes and only drops the cap note", async () => {
    const opts = { intakeRunsLastHour: 10 };
    const { env, apps } = makeEnv(opts);
    const first = await ingestApplication({ ...base, linkedinUrl: PROFILE, note: "subject: Hi; there" }, env, NOW);
    expect(first.note).toBe("intake run cap reached for this hour; subject: Hi; there");

    opts.intakeRunsLastHour = 0;
    const retried = await ingestApplication(base, env, NOW);
    expect(retried).toMatchObject({ status: "run-started", note: "subject: Hi; there" });
    expect(apps.get(first.applicationId)).toMatchObject({ status: "run-started", note: "subject: Hi; there" });
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

  it("a row left at received is resumed from the next delivery once it is older than the stale window", async () => {
    const opts: { r2Error?: Error } = { r2Error: new Error("R2 down") };
    const { env, apps, puts, create } = makeEnv(opts);
    const cv = { bytes: tinyPdf("Kubernetes"), filename: "cv.pdf", contentType: "application/pdf" };
    await expect(ingestApplication({ ...base, cv }, env, NOW)).rejects.toThrow("R2 down");
    const id = [...apps.keys()][0] ?? "";
    delete opts.r2Error;

    // Seconds later it may still be in flight: nothing happens.
    const inFlight = await ingestApplication({ ...base, cv }, env, new Date(NOW.getTime() + STALE_RECEIVED_MS - 1));
    expect(inFlight).toMatchObject({ applicationId: id, status: "received", duplicate: true });
    expect(create).not.toHaveBeenCalled();

    const resumed = await ingestApplication({ ...base, cv }, env, new Date(NOW.getTime() + STALE_RECEIVED_MS));
    expect(resumed).toMatchObject({ applicationId: id, status: "run-started", duplicate: true, note: null });
    expect(create).toHaveBeenCalledOnce();
    expect(puts.map((p) => p.key)).toEqual([`intake/${id}/cv.pdf`]);
    expect(apps.get(id)).toMatchObject({ status: "run-started", run_id: resumed.runId, cv_key: `intake/${id}/cv.pdf`, cv_text: "Kubernetes" });
    expect(apps.size).toBe(1);
  });

  it("a resumed row links the run its failed delivery had started instead of starting a second one", async () => {
    const { env, apps, investigations, create } = makeEnv();
    create.mockRejectedValueOnce(new Error("workflow create down"));
    await expect(ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW)).rejects.toThrow("workflow create down");
    const id = [...apps.keys()][0] ?? "";
    expect(investigations).toHaveLength(1);
    expect(apps.get(id)).toMatchObject({ status: "received" });

    const resumed = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, new Date(NOW.getTime() + STALE_RECEIVED_MS));
    expect(resumed).toMatchObject({ applicationId: id, status: "run-started", runId: investigations[0]?.id, duplicate: true });
    expect(investigations).toHaveLength(1);
    expect(create).toHaveBeenCalledOnce();
    expect(apps.get(id)).toMatchObject({ status: "run-started", run_id: investigations[0]?.id });
  });

  it("an unknown tag or a disallowed sender stores no CV file", async () => {
    const { env, apps, puts } = makeEnv();
    const cv = { bytes: tinyPdf("Kubernetes"), filename: "cv.pdf", contentType: "application/pdf" };
    const unknown = await ingestApplication({ ...base, tag: "nope", cv }, env, NOW);
    const denied = await ingestApplication({ ...base, externalId: "m2", cv }, env, NOW, { senderAllowed: false });
    expect(unknown.status).toBe("unmatched");
    expect(denied.status).toBe("unmatched");
    expect(puts).toHaveLength(0);
    expect(apps.get(unknown.applicationId)).toMatchObject({ cv_key: null, cv_text: "Kubernetes" });
    expect(apps.get(denied.applicationId)).toMatchObject({ cv_key: null });
  });

  it("rejects invalid input before touching D1", async () => {
    const { env, apps } = makeEnv();
    await expect(ingestApplication({ ...base, source: "fax" } as never, env, NOW)).rejects.toThrow();
    expect(apps.size).toBe(0);
  });
});
