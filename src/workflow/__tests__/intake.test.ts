/**
 * Tests for the intake funnel (ingestApplication) on the shared D1, R2 and Workflow fakes (fixtures/intake-fakes).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/intake.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Plans/010: a tag bound to a position and a manual add land as 'pooled' with position_id and start no run;
 *   a duplicate manual add returns the first row; a manual add for an unknown position is unmatched
 * - Cover specs/intake/funnel.md: happy path, CV-only PDF, duplicate (a resend with other details noted) and insert
 *   race, a connector's cvNote (no second parse), unknown tag, sender not
 *   allowed (no CV file stored for either), incomplete, capped (the capped retry and the cron's queue pass), a
 *   failure leaving the row at 'received' marked failed and its immediate resume by the next delivery (one winner
 *   when two race, CV stored, an already inserted run linked and its Workflow instance created), an unmarked
 *   'received' row resumed only after the stale window
 *
 * Design constraints:
 * - No module mocks; the fakes match on SQL prefixes and keep state in plain maps
 */
import { describe, expect, it } from "vitest";
import { tinyPdf } from "@/domain/__tests__/fixtures/tiny-pdf";
import { DELIVERY_FAILED_NOTE, ingestApplication, RESENT_PREFIX, retryCappedApplications, STALE_RECEIVED_MS } from "../intake";
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

  it("a repeat with the same details writes nothing; one with other details leaves only the latest resend note", async () => {
    const { env, apps, create, writes } = makeEnv();
    const first = await ingestApplication({ ...base, linkedinUrl: PROFILE, cvText: "Ten years of Go." }, env, NOW);
    const before = writes.length;
    await ingestApplication({ ...base, linkedinUrl: "linkedin.com/in/josef-buryan", cvText: "Ten years of Go." }, env, NOW);
    expect(writes).toHaveLength(before);

    await ingestApplication({ ...base, linkedinUrl: PROFILE, cvText: "Someone else entirely." }, env, NOW);
    const later = new Date(NOW.getTime() + 60_000);
    const last = await ingestApplication({ ...base, cvText: "Third try." }, env, later);
    expect(last).toMatchObject({ applicationId: first.applicationId, status: "run-started", duplicate: true });
    expect(apps.get(first.applicationId)?.note).toBe(`${RESENT_PREFIX}2026-10-08T12:01Z with other details (LinkedIn none, CV pasted text), the first send is kept`);
    expect(apps.get(first.applicationId)).toMatchObject({ linkedin_url: PROFILE, cv_text: "Ten years of Go." });
    expect(create).toHaveBeenCalledOnce();
  });

  it("does not parse a CV the connector already read (cvNote): the note is stored, no text", async () => {
    const { env, apps, puts } = makeEnv();
    const cv = { bytes: tinyPdf("Readable text"), filename: "cv.pdf", contentType: "application/pdf" };
    const res = await ingestApplication({ ...base, linkedinUrl: PROFILE, cv, cvNote: "PDF has no extractable text (scanned?)" }, env, NOW);
    expect(res.note).toBe("PDF has no extractable text (scanned?)");
    expect(apps.get(res.applicationId)).toMatchObject({ cv_text: null, status: "run-started" });
    expect(puts).toHaveLength(1);
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

  it("an unreadable CV file is stored, noted and leaves the application incomplete", async () => {
    const { env, puts } = makeEnv();
    const cv = { bytes: new ArrayBuffer(8), filename: "cv.doc", contentType: "application/msword" };
    const res = await ingestApplication({ ...base, cv }, env, NOW);
    expect(res.status).toBe("incomplete");
    expect(res.note).toContain("old Word (.doc) file stored, not read");
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
    expect(retried).toMatchObject({ applicationId: first.applicationId, status: "run-started", duplicate: true });
    expect(retried.runId).not.toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    // The first send's profile starts the run; the other one is only named in the resend note for the operator.
    expect(investigations[0]).toMatchObject({ profile_url: PROFILE, via: "intake", application_id: first.applicationId });
    expect(retried.note).toBe(`${RESENT_PREFIX}2026-10-08T12:00Z with other details (LinkedIn https://www.linkedin.com/in/someone-else, CV none), the first send is kept`);
    expect(apps.get(first.applicationId)).toMatchObject({ status: "run-started", run_id: retried.runId, note: retried.note });
  });

  it("a capped application pools on the next delivery once its tag is bound to a position", async () => {
    const opts: Parameters<typeof makeEnv>[0] = { intakeRunsLastHour: 10 };
    const { env, apps, create } = makeEnv(opts);
    const first = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);
    expect(first.status).toBe("capped");

    opts.tags = { "senior-be": { role: "Senior backend engineer", goal: "hiring", position_id: "pos-1" } };
    const retried = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);
    expect(retried).toMatchObject({ applicationId: first.applicationId, status: "pooled", runId: null, duplicate: true, note: null });
    expect(apps.get(first.applicationId)).toMatchObject({ status: "pooled", run_id: null, position_id: "pos-1", note: null });
    expect(create).not.toHaveBeenCalled();
  });

  it("a capped retry keeps the stored parser and subject notes and only drops the cap note", async () => {
    const opts = { intakeRunsLastHour: 10 };
    const { env, apps } = makeEnv(opts);
    const first = await ingestApplication({ ...base, linkedinUrl: PROFILE, note: "subject: Hi; there" }, env, NOW);
    expect(first.note).toBe("intake run cap reached for this hour; subject: Hi; there");

    opts.intakeRunsLastHour = 0;
    const retried = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);
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

  it("an R2 failure propagates and leaves the row at received, marked as a failed delivery", async () => {
    const { env, apps, create } = makeEnv({ r2Error: new Error("R2 down") });
    const cv = { bytes: tinyPdf("Kubernetes"), filename: "cv.pdf", contentType: "application/pdf" };
    await expect(ingestApplication({ ...base, cv }, env, NOW)).rejects.toThrow("R2 down");
    expect([...apps.values()][0]).toMatchObject({ status: "received", note: DELIVERY_FAILED_NOTE });
    expect(create).not.toHaveBeenCalled();
  });

  it("a failed delivery is resumed by the very next delivery, seconds later, with the CV stored", async () => {
    const opts: { r2Error?: Error } = { r2Error: new Error("R2 down") };
    const { env, apps, puts, create } = makeEnv(opts);
    const cv = { bytes: tinyPdf("Kubernetes"), filename: "cv.pdf", contentType: "application/pdf" };
    await expect(ingestApplication({ ...base, cv }, env, NOW)).rejects.toThrow("R2 down");
    const id = [...apps.keys()][0] ?? "";
    delete opts.r2Error;

    const resumed = await ingestApplication({ ...base, cv }, env, new Date(NOW.getTime() + 2_000));
    expect(resumed).toMatchObject({ applicationId: id, status: "run-started", duplicate: true, note: null });
    expect(create).toHaveBeenCalledOnce();
    expect(puts.map((p) => p.key)).toEqual([`intake/${id}/cv.pdf`]);
    expect(apps.get(id)).toMatchObject({ status: "run-started", run_id: resumed.runId, cv_key: `intake/${id}/cv.pdf`, cv_text: "Kubernetes", note: null });
    expect(apps.size).toBe(1);
  });

  it("a resume that fails again is marked again, so the delivery after it still resumes", async () => {
    const opts: { r2Error?: Error } = { r2Error: new Error("R2 down") };
    const { env, apps } = makeEnv(opts);
    const cv = { bytes: tinyPdf("Kubernetes"), filename: "cv.pdf", contentType: "application/pdf" };
    await expect(ingestApplication({ ...base, cv }, env, NOW)).rejects.toThrow("R2 down");
    await expect(ingestApplication({ ...base, cv }, env, NOW)).rejects.toThrow("R2 down");
    const id = [...apps.keys()][0] ?? "";
    expect(apps.get(id)).toMatchObject({ status: "received", note: DELIVERY_FAILED_NOTE });
    delete opts.r2Error;
    expect((await ingestApplication({ ...base, cv }, env, NOW)).status).toBe("run-started");
  });

  it("two retries racing on a failed row: one resumes, the other answers like an in-flight duplicate", async () => {
    const opts: { r2Error?: Error } = { r2Error: new Error("R2 down") };
    const { env, create } = makeEnv(opts);
    await expect(ingestApplication({ ...base, linkedinUrl: PROFILE, cv: { bytes: tinyPdf("x"), filename: "cv.pdf", contentType: "application/pdf" } }, env, NOW)).rejects.toThrow();
    delete opts.r2Error;
    const [a, b] = await Promise.all([ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW), ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW)]);
    expect([a.status, b.status].sort()).toEqual(["received", "run-started"]);
    expect(create).toHaveBeenCalledOnce();
  });

  it("an unmarked received row may still be in flight: resumed only once older than the stale window", async () => {
    const { env, apps, create } = makeEnv();
    apps.set("in-flight", { id: "in-flight", source: base.source, external_id: base.externalId, tag: "senior-be", status: "received", note: null, run_id: null, linkedin_url: null, received_at: NOW.toISOString() });

    const inFlight = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, new Date(NOW.getTime() + STALE_RECEIVED_MS - 1));
    expect(inFlight).toMatchObject({ applicationId: "in-flight", status: "received", duplicate: true });
    expect(create).not.toHaveBeenCalled();

    const resumed = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, new Date(NOW.getTime() + STALE_RECEIVED_MS));
    expect(resumed).toMatchObject({ applicationId: "in-flight", status: "run-started", duplicate: true });
    expect(create).toHaveBeenCalledOnce();
  });

  it("a resumed row links the run its failed delivery had inserted, creates its missing Workflow instance and stores the CV", async () => {
    const { env, apps, investigations, create, puts } = makeEnv();
    create.mockRejectedValueOnce(new Error("workflow create down"));
    const cv = { bytes: tinyPdf("Kubernetes"), filename: "cv.pdf", contentType: "application/pdf" };
    await expect(ingestApplication({ ...base, cv }, env, NOW)).rejects.toThrow("workflow create down");
    const id = [...apps.keys()][0] ?? "";
    expect(investigations).toHaveLength(1);
    expect(apps.get(id)).toMatchObject({ status: "received", note: DELIVERY_FAILED_NOTE });

    const resumed = await ingestApplication({ ...base, cv }, env, NOW);
    const runId = investigations[0]?.id;
    expect(resumed).toMatchObject({ applicationId: id, status: "run-started", runId, duplicate: true });
    expect(investigations).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenLastCalledWith({ id: runId, params: { runId } });
    expect(apps.get(id)).toMatchObject({ status: "run-started", run_id: runId, cv_text: "Kubernetes", cv_key: `intake/${id}/cv.pdf` });
    expect(puts).toHaveLength(2);
  });

  it("a linked run whose Workflow instance exists is not created twice", async () => {
    const { env, apps, investigations, create } = makeEnv();
    const first = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);
    // The row write after startRun was lost: the row is back at received and marked failed.
    apps.set(first.applicationId, { ...apps.get(first.applicationId), status: "received", run_id: null, note: DELIVERY_FAILED_NOTE });

    const resumed = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);
    expect(resumed).toMatchObject({ status: "run-started", runId: first.runId });
    expect(investigations).toHaveLength(1);
    expect(create).toHaveBeenCalledOnce();
  });

  it("the cron's queue pass starts capped applications oldest first while the hour has room, without a new delivery", async () => {
    const opts = { intakeRunsLastHour: 10 };
    const { env, apps, investigations } = makeEnv(opts);
    const older = await ingestApplication({ ...base, externalId: "a", linkedinUrl: PROFILE }, env, NOW);
    const newer = await ingestApplication({ ...base, externalId: "b", linkedinUrl: "https://www.linkedin.com/in/jana" }, env, new Date(NOW.getTime() + 1_000));
    expect([older.status, newer.status]).toEqual(["capped", "capped"]);

    expect(await retryCappedApplications(env, NOW)).toBe(0);
    expect(apps.get(older.applicationId)?.status).toBe("capped");

    opts.intakeRunsLastHour = 0;
    expect(await retryCappedApplications(env, NOW)).toBe(2);
    expect(investigations.map((i) => i.application_id)).toEqual([older.applicationId, newer.applicationId]);
    expect(apps.get(newer.applicationId)).toMatchObject({ status: "run-started", note: null });
  });

  it("the queue pass skips a capped row whose tag is gone instead of stopping there", async () => {
    const opts = { intakeRunsLastHour: 10 };
    const { env, apps } = makeEnv(opts);
    const orphan = await ingestApplication({ ...base, externalId: "a", linkedinUrl: PROFILE }, env, NOW);
    const next = await ingestApplication({ ...base, externalId: "b", linkedinUrl: PROFILE }, env, new Date(NOW.getTime() + 1_000));
    const orphanRow = apps.get(orphan.applicationId);
    if (orphanRow) orphanRow.tag = "closed-role";

    opts.intakeRunsLastHour = 0;
    expect(await retryCappedApplications(env, NOW)).toBe(1);
    expect(apps.get(next.applicationId)?.status).toBe("run-started");
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

  it("a tag bound to a position pools the application: no run, position_id written, CV file kept", async () => {
    const { env, apps, investigations, create, puts, countArgs } = makeEnv({
      tags: { "senior-be": { role: "Senior backend engineer", goal: "hiring", position_id: "pos-1" } },
    });
    const cv = { bytes: tinyPdf("Kubernetes"), filename: "cv.pdf", contentType: "application/pdf" };
    const res = await ingestApplication({ ...base, cv }, env, NOW);
    expect(res).toMatchObject({ status: "pooled", runId: null, duplicate: false, note: null });
    expect(apps.get(res.applicationId)).toMatchObject({ status: "pooled", run_id: null, position_id: "pos-1", cv_text: "Kubernetes" });
    expect(puts.map((p) => p.key)).toEqual([`intake/${res.applicationId}/cv.pdf`]);
    expect(create).not.toHaveBeenCalled();
    expect(investigations).toHaveLength(0);
    expect(countArgs).toHaveLength(0);
  });

  it("a position-bound tag with an incomplete application is still incomplete, not pooled", async () => {
    const { env } = makeEnv({ tags: { "senior-be": { role: "x", goal: "hiring", position_id: "pos-1" } } });
    expect((await ingestApplication(base, env, NOW)).status).toBe("incomplete");
  });

  it("a tag without a position keeps auto-starting and writes a NULL position_id", async () => {
    const { env, apps, create } = makeEnv();
    const res = await ingestApplication({ ...base, linkedinUrl: PROFILE }, env, NOW);
    expect(res.status).toBe("run-started");
    expect(apps.get(res.applicationId)).toMatchObject({ position_id: null });
    expect(create).toHaveBeenCalledOnce();
  });

  it("a manual add pools under its position and starts no run", async () => {
    const { env, apps, create } = makeEnv({ positions: { "pos-1": "Senior backend engineer" } });
    const res = await ingestApplication(
      { source: "manual", externalId: "stable-1", positionId: "pos-1", name: "Eva", linkedinUrl: PROFILE },
      env,
      NOW,
    );
    expect(res).toMatchObject({ status: "pooled", runId: null, duplicate: false, note: null });
    expect(apps.get(res.applicationId)).toMatchObject({ source: "manual", status: "pooled", position_id: "pos-1", linkedin_url: PROFILE });
    expect(create).not.toHaveBeenCalled();
  });

  it("a duplicate manual add returns the first row as a duplicate and adds no second row", async () => {
    const { env, apps } = makeEnv({ positions: { "pos-1": "Senior backend engineer" } });
    const input = { source: "manual", externalId: "stable-1", positionId: "pos-1", linkedinUrl: PROFILE } as const;
    const first = await ingestApplication(input, env, NOW);
    const again = await ingestApplication(input, env, NOW);
    expect(again).toEqual({ ...first, duplicate: true });
    expect(apps.size).toBe(1);
  });

  it("a manual add for an unknown position is unmatched", async () => {
    const { env, apps } = makeEnv();
    const res = await ingestApplication({ source: "manual", externalId: "s", positionId: "nope", linkedinUrl: PROFILE }, env, NOW);
    expect(res).toMatchObject({ status: "unmatched", runId: null, note: "unknown position" });
    expect(apps.get(res.applicationId)).toMatchObject({ position_id: null });
  });

  it("a manual add without a positionId is unmatched", async () => {
    const { env } = makeEnv();
    const result = await ingestApplication({ source: "manual", externalId: "s", linkedinUrl: PROFILE }, env, NOW);
    expect(result.status).toBe("unmatched");
    expect(result.note).toContain("unknown position");
    expect(result.runId).toBeNull();
  });

  it("rejects invalid input before touching D1", async () => {
    const { env, apps } = makeEnv();
    await expect(ingestApplication({ ...base, source: "fax" } as never, env, NOW)).rejects.toThrow();
    expect(apps.size).toBe(0);
  });
});
