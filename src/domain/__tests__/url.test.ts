/**
 * Tests for canonicalUrl: trailing slash, host case, noise query parameters.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/url.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Two spellings of one profile collapse to one string; real query parameters stay
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { canonicalUrl } from "@/domain/url";

describe("canonicalUrl", () => {
  it("collapses trailing slash, host case, fragment and locale/l parameters", () => {
    const want = "https://www.linkedin.com/in/josef-buryan";
    expect(canonicalUrl("https://www.linkedin.com/in/josef-buryan/")).toBe(want);
    expect(canonicalUrl("https://WWW.LinkedIn.com/in/josef-buryan?locale=cs_CZ")).toBe(want);
    expect(canonicalUrl("https://www.linkedin.com/in/josef-buryan/?l=en#about")).toBe(want);
  });

  it("keeps other query parameters and a bare host", () => {
    expect(canonicalUrl("https://www.facebook.com/profile.php?id=42&locale=cs")).toBe("https://www.facebook.com/profile.php?id=42");
    expect(canonicalUrl("https://example.com/")).toBe("https://example.com");
  });

  it("returns a non-URL unchanged", () => {
    expect(canonicalUrl(" not a url ")).toBe("not a url");
  });
});
