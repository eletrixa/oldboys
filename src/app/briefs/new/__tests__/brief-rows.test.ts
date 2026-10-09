/**
 * Tests for the New brief wizard helpers: row readiness, request bodies, idempotent patch, counts and enrich ids.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/new/__tests__/brief-rows.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - One case per helper, including the blank row and the file row
 *
 * Design constraints:
 * - Pure; File comes from the Node global
 */
import { describe, expect, it } from "vitest";
import { candidateBody, emptyRow, enrichIds, failText, patchRow, researchCount, rowReady, type DraftRow } from "../brief-rows";

const row = (over: Partial<DraftRow>): DraftRow => ({ ...emptyRow("r1"), ...over });

describe("brief rows", () => {
  it("needs the field of the chosen source", () => {
    expect(rowReady(emptyRow("r1"))).toBe(false);
    expect(rowReady(row({ linkedinUrl: " https://www.linkedin.com/in/ada " }))).toBe(true);
    expect(rowReady(row({ source: "cv", linkedinUrl: "https://www.linkedin.com/in/ada" }))).toBe(false);
    expect(rowReady(row({ source: "file", file: new File(["x"], "cv.pdf") }))).toBe(true);
    expect(rowReady(row({ source: "file", file: new File([], "cv.pdf") }))).toBe(false);
  });

  it("builds a trimmed JSON body, none for files", () => {
    expect(candidateBody(row({ linkedinUrl: " https://www.linkedin.com/in/ada " }))).toEqual({ linkedinUrl: "https://www.linkedin.com/in/ada" });
    expect(candidateBody(row({ source: "cv", cvText: " Ada, analyst " }))).toEqual({ cvText: "Ada, analyst" });
    expect(candidateBody(row({ source: "file", file: new File(["x"], "cv.txt") }))).toBeNull();
    expect(candidateBody(emptyRow("r1"))).toBeNull();
  });

  it("patches one row and returns the same array when nothing changes", () => {
    const rows = [emptyRow("a"), emptyRow("b")];
    expect(patchRow(rows, "a", { linkedinUrl: "" })).toBe(rows);
    expect(patchRow(rows, "zz", { cvText: "x" })).toBe(rows);
    const next = patchRow(rows, "b", { source: "cv" });
    expect(next).not.toBe(rows);
    expect(next.map((r) => r.source)).toEqual(["linkedin", "cv"]);
  });

  it("counts ready rows plus ticked pool rows and de-duplicates ids", () => {
    expect(researchCount([row({ linkedinUrl: "u" }), emptyRow("r2")], new Set(["p1", "p2"]))).toBe(3);
    expect(enrichIds(["a1", "p1"], new Set(["p1", "p2"]))).toEqual(["a1", "p1", "p2"]);
  });

  it("says the cap calmly and keeps other fallbacks", () => {
    expect(failText(429, "x")).toMatch(/kept here/);
    expect(failText(500, "x")).toBe("x");
  });
});
