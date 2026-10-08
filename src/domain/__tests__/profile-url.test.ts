/**
 * Tests for LinkedIn profile URL normalisation and the handle-derived name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/profile-url.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - normalizeLinkedinProfile accepts /in/ profiles in any common form and rejects everything else
 * - nameFromHandle drops LinkedIn's numeric suffix
 *
 * Design constraints:
 * - Pure
 */
import { describe, expect, it } from "vitest";
import { nameFromHandle, normalizeLinkedinProfile } from "@/domain/profile-url";

describe("normalizeLinkedinProfile", () => {
  it.each([
    "https://cz.linkedin.com/in/josef-buryan",
    "http://www.linkedin.com/in/Josef-Buryan/?originalSubdomain=cz",
    "linkedin.com/in/josef-buryan",
    "https://www.linkedin.com/in/josef-buryan/cs",
    " https://linkedin.com/in/josef-buryan#about ",
  ])("%s -> https://www.linkedin.com/in/josef-buryan", (raw) => {
    expect(normalizeLinkedinProfile(raw)).toBe("https://www.linkedin.com/in/josef-buryan");
  });

  it.each([
    "https://www.linkedin.com/company/groupon",
    "https://www.linkedin.com/posts/josef-buryan_123",
    "https://evil.com/in/josef-buryan",
    "https://linkedin.com.evil.com/in/x",
    "Josef Buryan",
    "",
  ])("rejects %s", (raw) => {
    expect(normalizeLinkedinProfile(raw)).toBeNull();
  });
});

describe("nameFromHandle", () => {
  it("title-cases the handle words and drops id suffixes", () => {
    expect(nameFromHandle("https://www.linkedin.com/in/josef-buryan-4a1b2c3")).toBe("Josef Buryan");
    expect(nameFromHandle("https://www.linkedin.com/in/12345")).toBe("");
  });
});
