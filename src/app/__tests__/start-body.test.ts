/**
 * Tests for the start form body builder and query reader (G7, G8 of specs/positions-pages.md).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/__tests__/start-body.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - With a positionId: positionId in the body, no role; without: the body the form always sent
 * - positionIdParam: absent, blank and padded values
 *
 * Design constraints:
 * - Pure: no React
 */
import { describe, expect, it } from "vitest";
import { buildStartBody, positionIdParam } from "../start-body";

describe("buildStartBody", () => {
  it("sends positionId and no role when a position is chosen", () => {
    const body = buildStartBody({ role: "Ignored", profileUrl: "linkedin.com/in/jan", cvText: "", positionId: "pos-1" });
    expect(body).toEqual({ goal: "hiring", positionId: "pos-1", profileUrl: "linkedin.com/in/jan" });
    expect(body).not.toHaveProperty("role");
  });

  it("builds the unchanged body without a position", () => {
    expect(buildStartBody({ role: "Data Engineer", profileUrl: "", cvText: "My CV", positionId: null })).toEqual({
      goal: "hiring",
      role: "Data Engineer",
      cvText: "My CV",
    });
  });
});

describe("positionIdParam", () => {
  const params = (q: string) => new URLSearchParams(q);
  it("reads and trims the value", () => {
    expect(positionIdParam(params("positionId=%20pos-1%20"))).toBe("pos-1");
  });
  it("returns null when absent or blank", () => {
    expect(positionIdParam(params(""))).toBeNull();
    expect(positionIdParam(params("positionId=%20"))).toBeNull();
  });
});
