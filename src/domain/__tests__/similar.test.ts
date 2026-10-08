/**
 * Tests for the near-duplicate text test: folded equality, Jaccard threshold, distinct texts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/similar.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { jaccard, nearDuplicate, tokens } from "@/domain/similar";

describe("similar", () => {
  it("folds case, diacritics and punctuation into tokens", () => {
    expect([...tokens("Josef Buryán, CMO!")]).toEqual(["josef", "buryan", "cmo"]);
  });

  it("treats folded-equal texts as duplicates", () => {
    expect(nearDuplicate("He is CMO of Groupon.", "he is cmo of groupon")).toBe(true);
  });

  it("treats texts with token Jaccard >= 0.8 as duplicates", () => {
    const a = "Josef Buryan is Chief Marketing Officer at Groupon since February 2025";
    const b = "Josef Buryan is Chief Marketing Officer at Groupon since Feb 2025";
    expect(jaccard(a, b)).toBeGreaterThanOrEqual(0.8);
    expect(nearDuplicate(a, b)).toBe(true);
  });

  it("keeps distinct texts apart", () => {
    expect(nearDuplicate("He was CMO at Tipli", "He was CMO at Vilgain")).toBe(false);
    expect(jaccard("", "")).toBe(0);
  });
});
