/**
 * Tests for canonicalUrl: trailing slash, host case, noise and tracking parameters, LinkedIn host and locale.
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

  it("folds LinkedIn country hosts and the /in/<handle>/<locale> suffix", () => {
    const want = canonicalUrl("https://www.linkedin.com/in/josef-buryan/");
    expect(canonicalUrl("https://cz.linkedin.com/in/josef-buryan/cs")).toBe(want);
    expect(canonicalUrl("https://linkedin.com/in/josef-buryan")).toBe(want);
    expect(canonicalUrl("https://www.linkedin.com/company/acme/cs")).toBe("https://www.linkedin.com/company/acme/cs");
  });

  it("drops tracking parameters srsltid, utm_*, fbclid and igsh", () => {
    expect(canonicalUrl("https://example.com/a?srsltid=x&utm_source=g&utm_medium=c&fbclid=1&igsh=2&q=keep")).toBe("https://example.com/a?q=keep");
  });

  it("returns a non-URL unchanged", () => {
    expect(canonicalUrl(" not a url ")).toBe("not a url");
  });
});
