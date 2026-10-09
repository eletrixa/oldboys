/**
 * Tests for the candidate pool request bodies.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/__tests__/candidate-body.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - CandidateBody needs a LinkedIn URL or CV text; manualIntake is stable per position and profile; EnrichBody caps at 20 plain ids
 *
 * Design constraints:
 * - Pure: no D1, no Next.js
 */
import { describe, expect, it } from "vitest";
import { CandidateBody, EnrichBody, manualIntake } from "../candidate-body";

describe("CandidateBody", () => {
  it("needs a LinkedIn URL or CV text", () => {
    expect(CandidateBody.safeParse({}).success).toBe(false);
    expect(CandidateBody.safeParse({ name: "Ada", email: "ada@example.com" }).success).toBe(false);
    expect(CandidateBody.safeParse({ linkedinUrl: "linkedin.com/in/ada" }).success).toBe(true);
    expect(CandidateBody.safeParse({ cvText: "Ten years of Go" }).success).toBe(true);
  });
  it("rejects a bad email and over-long fields", () => {
    expect(CandidateBody.safeParse({ cvText: "x", email: "nope" }).success).toBe(false);
    expect(CandidateBody.safeParse({ cvText: "x", name: "n".repeat(201) }).success).toBe(false);
    expect(CandidateBody.safeParse({ linkedinUrl: "u".repeat(501) }).success).toBe(false);
  });
});

describe("manualIntake", () => {
  it("normalises the profile, binds the position and keeps the id stable across URL spellings", () => {
    const a = manualIntake("p1", { linkedinUrl: "linkedin.com/in/Ada?x=1", name: "Ada" });
    const b = manualIntake("p1", { linkedinUrl: "https://cz.linkedin.com/in/ada/" });
    expect(a).toMatchObject({ source: "manual", positionId: "p1", name: "Ada", linkedinUrl: "https://www.linkedin.com/in/ada" });
    expect(a.externalId).toBe(b.externalId);
    expect(manualIntake("p2", { linkedinUrl: "linkedin.com/in/ada" }).externalId).not.toBe(a.externalId);
  });
  it("passes a non-profile URL through raw and falls back to the CV text as the key", () => {
    expect(manualIntake("p1", { linkedinUrl: "https://example.com/ada" }).linkedinUrl).toBe("https://example.com/ada");
    const cv = manualIntake("p1", { cvText: "CV body" });
    expect(cv).toMatchObject({ cvText: "CV body" });
    expect(cv).not.toHaveProperty("linkedinUrl");
  });
});

describe("EnrichBody", () => {
  it("takes 1..20 plain ids", () => {
    expect(EnrichBody.safeParse({ applicationIds: ["a-1"] }).success).toBe(true);
    expect(EnrichBody.safeParse({ applicationIds: [] }).success).toBe(false);
    expect(EnrichBody.safeParse({ applicationIds: Array.from({ length: 21 }, (_, i) => `a${String(i)}`) }).success).toBe(true);
    expect(EnrichBody.safeParse({ applicationIds: Array.from({ length: 201 }, (_, i) => `a${String(i)}`) }).success).toBe(false);
    expect(EnrichBody.safeParse({ applicationIds: ["bad id"] }).success).toBe(false);
    expect(EnrichBody.safeParse({ applicationIds: ["x".repeat(65)] }).success).toBe(false);
  });
});
