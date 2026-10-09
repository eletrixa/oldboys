/**
 * Tests for the CV consistency check primitives (idea #14): question gating, outcome classification, interview question.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/cv-check.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { CV_QUESTION, CV_QUESTION_ID, cvInterviewQuestion, cvOutcome, isCvSource, withCvQuestion } from "@/domain/cv-check";

const base = [{ id: "current-role", text: "What is the subject's current role and employer?" }];
const cvSource = { url: "cv:run-1", actor: "cv" };
const linkedin = { url: "https://www.linkedin.com/in/jana", actor: "harvestapi/linkedin-profile-scraper" };

describe("withCvQuestion", () => {
  it("adds cv-consistency to a hiring run that has the CV among its sources", () => {
    expect(withCvQuestion("hiring", base, [linkedin, cvSource])).toEqual([...base, CV_QUESTION]);
  });

  it("returns the questions unchanged without a CV, for due-diligence, and when the question is already there", () => {
    expect(withCvQuestion("hiring", base, [linkedin])).toEqual(base);
    expect(withCvQuestion("hiring", base, [])).toEqual(base);
    expect(withCvQuestion("due-diligence", base, [cvSource])).toEqual(base);
    expect(withCvQuestion("hiring", [...base, CV_QUESTION], [cvSource])).toHaveLength(2);
  });

  it("recognises the CV by actor or by its cv: pseudo URL (the state API has no actor column)", () => {
    expect(isCvSource({ url: "cv:run-1" })).toBe(true);
    expect(isCvSource({ url: "https://x", actor: "cv" })).toBe(true);
    expect(isCvSource(linkedin)).toBe(false);
    expect(withCvQuestion("hiring", base, [{ url: "cv:run-1" }]).map((q) => q.id)).toEqual(["current-role", CV_QUESTION_ID]);
  });
});

describe("cvOutcome", () => {
  const cvIds = new Set(["cv"]);
  it("FACT citing a public source matches, INFERENCE citing one differs, anything citing only the CV is not found", () => {
    expect(cvOutcome({ kind: "FACT", supports: ["li", "cv"] }, cvIds)).toBe("matches");
    expect(cvOutcome({ kind: "INFERENCE", supports: ["li", "cv"] }, cvIds)).toBe("differs");
    expect(cvOutcome({ kind: "INFERENCE", supports: ["cv"] }, cvIds)).toBe("not-found");
    expect(cvOutcome({ kind: "FACT", supports: ["cv"] }, cvIds)).toBe("not-found");
  });
});

describe("cvInterviewQuestion", () => {
  it("turns 'CV: … Public <platform>: …' into a neutral question", () => {
    expect(cvInterviewQuestion("CV: Team lead at Acme from 2020. Public LinkedIn: Team lead at Acme from 2022.")).toBe(
      "Your CV lists: Team lead at Acme from 2020. The public LinkedIn shows: Team lead at Acme from 2022. Could you walk us through it?",
    );
  });

  it("quotes any other wording as is", () => {
    expect(cvInterviewQuestion("The CV and GitHub name different employers for 2021.")).toBe(
      "About your CV: The CV and GitHub name different employers for 2021. Could you walk us through it?",
    );
  });

  it("never uses verdict words", () => {
    const q = cvInterviewQuestion("CV: CTO at Beta 2019-2021. Public GitHub: Engineer at Beta 2019-2021.");
    expect(q).not.toMatch(/fake|lie|inflat|dishonest|suspicious|fraud/i);
  });
});
