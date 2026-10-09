/**
 * Tests for the shared count-with-noun helper.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_lib/__tests__/plural.test.ts
 * Deps:    vitest, ../plural
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Singular at 1, plural at 0 and 2, explicit irregular plural
 */
import { describe, expect, it } from "vitest";
import { plural } from "../plural";

describe("plural", () => {
  it("uses the singular only for exactly one", () => {
    expect(plural(1, "brief")).toBe("1 brief");
    expect(plural(0, "brief")).toBe("0 briefs");
    expect(plural(2, "brief")).toBe("2 briefs");
  });
  it("takes an explicit plural form", () => {
    expect(plural(3, "criterion", "criteria")).toBe("3 criteria");
  });
});
