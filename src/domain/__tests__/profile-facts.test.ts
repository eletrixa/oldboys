/**
 * Tests for profile facts: defensive ledger readback, step ordering, experience year, bio clipping.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/profile-facts.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { BIO_MAX, clipBio, count, experienceYear, facts, readProfileFacts } from "@/domain/profile-facts";

const row = (step: string, digest: unknown): { step: string; ref_json: string } => ({ step, ref_json: JSON.stringify({ digest }) });
const f = (platform: string): ReturnType<typeof facts> => facts(platform, `https://${platform}.example/me`, { source_url: `https://${platform}.example/api` });

describe("readProfileFacts", () => {
  it("returns [] for rows without a digest, a non-facts digest or malformed JSON", () => {
    expect(
      readProfileFacts([
        { step: "x_profile", ref_json: "{}" },
        { step: "x_profile", ref_json: null },
        { step: "github_deep", ref_json: JSON.stringify({ digest: { handle: "me", repos_owned: 3 } }) },
        { step: "x_profile", ref_json: "{not json" },
        { step: null, ref_json: JSON.stringify({ digest: [f("x")] }) },
      ]),
    ).toEqual([]);
  });

  it("lets the newest row per step win", () => {
    const older = { ...f("x"), followers: 1 };
    const newer = { ...f("x"), followers: 2 };
    expect(readProfileFacts([row("x_profile", [older]), row("x_profile", [newer])])).toEqual([newer]);
  });

  it("keeps ledger order, a retried step staying at its first position", () => {
    const out = readProfileFacts([row("seed_profile", [f("linkedin")]), row("x_profile", [f("x")]), row("github_profile", [f("github")]), row("x_profile", [f("x"), f("bluesky")])]);
    expect(out.map((p) => p.platform)).toEqual(["linkedin", "x", "bluesky", "github"]);
  });

  it("skips a malformed row without dropping the others", () => {
    const out = readProfileFacts([row("x_profile", [{ platform: "x" }]), row("github_profile", [f("github")])]);
    expect(out.map((p) => p.platform)).toEqual(["github"]);
  });
});

describe("experienceYear", () => {
  it("picks the earliest year from mixed strings, numbers and null", () => {
    expect(experienceYear(["Head @ Acme (2015–2019)", 2011, null, undefined, "Intern 2013", {}])).toBe(2011);
  });

  it("returns null when nothing parses", () => {
    expect(experienceYear([])).toBeNull();
    expect(experienceYear(["no dates", 1801, null])).toBeNull();
  });
});

describe("facts", () => {
  it("defaults source_url to url and lets over set fields", () => {
    expect(facts("x", "https://x.com/me")).toMatchObject({ platform: "x", url: "https://x.com/me", source_url: "https://x.com/me", followers: null });
    expect(facts("x", "https://x.com/me", { followers: 3, source_url: "https://api/x" })).toMatchObject({ followers: 3, source_url: "https://api/x" });
  });
});

describe("count", () => {
  it("keeps non-negative integers, truncates, else null", () => {
    expect(count(12.9)).toBe(12);
    expect([count(-1), count(null), count(undefined), count(Number.NaN)]).toEqual([null, null, null, null]);
  });
});

describe("clipBio", () => {
  it("collapses whitespace and returns null for empty text", () => {
    expect(clipBio("  a \n b  ")).toBe("a b");
    expect(clipBio("   ")).toBeNull();
    expect(clipBio(null)).toBeNull();
  });

  it("clips at BIO_MAX with an ellipsis", () => {
    const out = clipBio("a".repeat(BIO_MAX + 50));
    expect(out).toHaveLength(BIO_MAX);
    expect(out?.endsWith("…")).toBe(true);
    expect(clipBio("a".repeat(BIO_MAX))).toHaveLength(BIO_MAX);
  });
});
