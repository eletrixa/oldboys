/**
 * Tests for the StartupJobs webhook schema and its mapping to IntakeInput.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/startupjobs.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover the documented and test payloads, string ids, null fields, field mapping and tag precedence
 *
 * Design constraints:
 * - Every mapped result must also pass IntakeInput, so the funnel never throws on a StartupJobs field
 */
import { describe, expect, it } from "vitest";
import { IntakeInput } from "../application";
import { StartupJobsWebhook, tagFor, toIntakeInput } from "../startupjobs";

const DOCUMENTED = {
  date: "2017-09-11T18:19:15+02:00",
  candidateID: 12345,
  offerID: 1234,
  name: "Pan Žralok",
  position: "Vývojář webhooků",
  why: "<p>Mám rád &amp; umím <b>webhooky</b></p>",
  phone: "+420 123 456 789",
  email: "dev@startupjobs.cz",
  details: "https://www.startupjobs.cz/admin/x",
  linkedin: "https://linkedin.com/in/pan-zralok",
  internalPositionName: "JOB1",
  files: ["https://www.startupjobs.cz/download/file.pdf"],
  gdpr_accepted: true,
};

describe("StartupJobsWebhook", () => {
  it("accepts the documented payload and keeps unknown fields", () => {
    const p = StartupJobsWebhook.parse({ ...DOCUMENTED, extra: 1 });
    expect(p).toMatchObject({ candidateID: 12345, offerID: 1234, files: DOCUMENTED.files, extra: 1 });
  });

  it("accepts the test payload", () => {
    expect(StartupJobsWebhook.parse({ ...DOCUMENTED, test: true }).test).toBe(true);
  });

  it("coerces string ids and defaults files to an empty list", () => {
    const p = StartupJobsWebhook.parse({ candidateID: "7", offerID: "1234" });
    expect(p).toMatchObject({ candidateID: 7, offerID: 1234, files: [] });
  });

  it("tolerates null optional fields", () => {
    const p = StartupJobsWebhook.parse({ candidateID: 1, offerID: 2, phone: null, linkedin: null, why: null, files: null });
    expect(p.files).toEqual([]);
  });

  it("rejects a payload without ids", () => {
    expect(StartupJobsWebhook.safeParse({ name: "x" }).success).toBe(false);
    expect(StartupJobsWebhook.safeParse({ candidateID: "abc", offerID: 1 }).success).toBe(false);
    for (const bad of [null, "", 0, -1]) {
      expect(StartupJobsWebhook.safeParse({ candidateID: bad, offerID: 1 }).success, String(bad)).toBe(false);
    }
  });
});

describe("toIntakeInput", () => {
  it("maps the documented payload", () => {
    const input = toIntakeInput(StartupJobsWebhook.parse(DOCUMENTED), "job1");
    expect(input).toEqual({
      source: "startupjobs",
      externalId: "1234:12345",
      tag: "job1",
      name: "Pan Žralok",
      email: "dev@startupjobs.cz",
      phone: "+420 123 456 789",
      linkedinUrl: "https://linkedin.com/in/pan-zralok",
      coverLetter: "Mám rád & umím webhooky",
      note: "startupjobs offer 1234 Vývojář webhooků",
    });
    expect(IntakeInput.safeParse(input).success).toBe(true);
  });

  it("passes the CV file through", () => {
    const cv = { bytes: new ArrayBuffer(4), filename: "file.pdf", contentType: "application/pdf" };
    expect(toIntakeInput(StartupJobsWebhook.parse(DOCUMENTED), undefined, cv).cv).toBe(cv);
  });

  it("marks a test payload with its own note and external id", () => {
    const input = toIntakeInput(StartupJobsWebhook.parse({ ...DOCUMENTED, test: true }), undefined);
    expect(input.note).toBe("StartupJobs test payload");
    expect(input.externalId).toBe("test:1234:12345");
    expect(input.tag).toBeUndefined();
  });

  it("drops empty, null and invalid fields instead of failing the funnel", () => {
    const p = StartupJobsWebhook.parse({
      candidateID: 1,
      offerID: 2,
      name: "  ",
      email: "not an email",
      phone: "",
      linkedin: null,
      why: "<p></p>",
    });
    const input = toIntakeInput(p, undefined);
    expect(input).toEqual({ source: "startupjobs", externalId: "2:1", note: "startupjobs offer 2; invalid email" });
    expect(IntakeInput.safeParse(input).success).toBe(true);
  });

  it("truncates over-long fields to the IntakeInput limits", () => {
    const p = StartupJobsWebhook.parse({
      candidateID: 1,
      offerID: 2,
      name: "n".repeat(500),
      phone: "1".repeat(100),
      linkedin: "l".repeat(900),
      why: "w".repeat(20_000),
      position: "p".repeat(2000),
    });
    const input = toIntakeInput(p, undefined);
    expect(IntakeInput.safeParse(input).success).toBe(true);
  });
});

describe("tagFor", () => {
  const p = StartupJobsWebhook.parse(DOCUMENTED);

  it("prefers the offer id mapping", () => {
    expect(tagFor(p, "senior-be")).toBe("senior-be");
  });

  it("falls back to the internal position name, lower-cased", () => {
    expect(tagFor(p)).toBe("job1");
  });

  it("ignores an internal position name that is not a tag", () => {
    expect(tagFor({ ...p, internalPositionName: "Senior Dev!" })).toBeUndefined();
    expect(tagFor({ ...p, internalPositionName: undefined })).toBeUndefined();
  });
});
