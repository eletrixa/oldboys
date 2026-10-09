/**
 * Tests for the intake application schemas and pure decisions (tag shape, input contract, candidate input, status).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/application.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover specs/intake/data.md test list: IntakeTag, IntakeInput, candidateInput, decideStatus, safeFilename, cvR2Key
 *
 * Design constraints:
 * - Pure; no fakes needed
 */
import { describe, expect, it } from "vitest";
import { CV_MAX as RUN_BODY_CV_MAX } from "@/app/api/_lib/run-body";
import { candidateInput, CV_MAX, cvR2Key, decideStatus, IntakeInput, IntakeTag, safeFilename } from "../application";

describe("IntakeTag", () => {
  it("accepts a lowercase slug", () => {
    expect(IntakeTag.safeParse("senior-be-2026").success).toBe(true);
  });

  it.each(["Senior", "-x", "a".repeat(41), "", "x"])("rejects %j", (tag) => {
    expect(IntakeTag.safeParse(tag).success).toBe(false);
  });
});

describe("IntakeInput", () => {
  const base = { source: "email", externalId: "<m1@x>" } as const;

  it("rejects an unknown source", () => {
    expect(IntakeInput.safeParse({ ...base, source: "fax" }).success).toBe(false);
  });

  it("rejects a cvText over CV_MAX", () => {
    expect(IntakeInput.safeParse({ ...base, cvText: "x".repeat(CV_MAX + 1) }).success).toBe(false);
  });

  it("trims and lowercases the tag", () => {
    expect(IntakeInput.parse({ ...base, tag: " Senior-BE " }).tag).toBe("senior-be");
  });

  it("accepts a CV file", () => {
    const cv = { bytes: new ArrayBuffer(4), filename: "cv.pdf", contentType: "application/pdf" };
    expect(IntakeInput.parse({ ...base, cv }).cv?.filename).toBe("cv.pdf");
  });

  it("rejects a bad email", () => {
    expect(IntakeInput.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
  });

  it("CV_MAX is the same constant run-body re-exports", () => {
    expect(RUN_BODY_CV_MAX).toBe(CV_MAX);
    expect(CV_MAX).toBe(20_000);
  });
});

describe("candidateInput", () => {
  it("normalises a country-host LinkedIn URL with a query", () => {
    expect(candidateInput({ linkedinUrl: "cz.linkedin.com/in/Josef-Buryan?x=1" })).toEqual({
      profileUrl: "https://www.linkedin.com/in/josef-buryan",
      notes: [],
    });
  });

  it("drops a company page with a note", () => {
    const out = candidateInput({ linkedinUrl: "linkedin.com/company/x" });
    expect(out.profileUrl).toBeUndefined();
    expect(out.notes).toHaveLength(1);
    expect(out.notes[0]).toContain("linkedin.com/company/x");
  });

  it("passes cvText through", () => {
    expect(candidateInput({ cvText: "Ten years of Go." })).toEqual({ cvText: "Ten years of Go.", notes: [] });
  });

  it("is empty for empty input", () => {
    expect(candidateInput({})).toEqual({ notes: [] });
  });
});

describe("decideStatus", () => {
  const ok = { tagKnown: true, senderAllowed: true, candidate: { profileUrl: "https://www.linkedin.com/in/x1" }, capped: false };

  it("run-started when everything passes", () => {
    expect(decideStatus(ok)).toEqual({ status: "run-started", note: null });
  });

  it("unknown tag wins over everything else", () => {
    expect(decideStatus({ tagKnown: false, senderAllowed: false, candidate: {}, capped: true })).toEqual({
      status: "unmatched",
      note: "unknown tag",
    });
  });

  it("sender not allowed wins over incomplete", () => {
    expect(decideStatus({ ...ok, senderAllowed: false, candidate: {} })).toEqual({
      status: "unmatched",
      note: "sender not allowed",
    });
  });

  it("incomplete wins over capped", () => {
    expect(decideStatus({ ...ok, candidate: {}, capped: true }).status).toBe("incomplete");
  });

  it("cvText alone is complete", () => {
    expect(decideStatus({ ...ok, candidate: { cvText: "cv" } }).status).toBe("run-started");
  });

  it("capped when complete but over the cap", () => {
    expect(decideStatus({ ...ok, capped: true }).status).toBe("capped");
  });
});

describe("safeFilename", () => {
  it("strips directories (both separators)", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Users\\me\\CV.pdf")).toBe("CV.pdf");
  });

  it("folds diacritics and replaces odd characters", () => {
    expect(safeFilename("Životopis Josef (1).pdf")).toBe("Zivotopis_Josef_1.pdf");
  });

  it("keeps the extension of a name with no readable characters", () => {
    expect(safeFilename("资料.pdf")).toBe("cv.pdf");
    expect(safeFilename("履歴書.docx")).toBe("cv.docx");
    expect(safeFilename(".pdf")).toBe("cv.pdf");
  });

  it("caps length at 80", () => {
    const long = safeFilename(`${"a".repeat(200)}.pdf`);
    expect(long).toHaveLength(80);
    expect(long.endsWith(".pdf")).toBe(true);
  });

  it.each(["", "   ", "/", "..", "."])("defaults %j to cv.pdf", (name) => {
    expect(safeFilename(name)).toBe("cv.pdf");
  });
});

describe("cvR2Key", () => {
  it("prefixes intake/<id>/ and sanitises the name", () => {
    expect(cvR2Key("app-1", "dir/My CV.pdf")).toBe("intake/app-1/My_CV.pdf");
  });
});
