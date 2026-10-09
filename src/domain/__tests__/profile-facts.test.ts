/**
 * Tests for profile facts: defensive ledger readback, step ordering, experience year, bio clipping.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/profile-facts.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { BIO_MAX, clipBio, emptyFacts, experienceYear, readProfileFacts } from "@/domain/profile-facts";

const row = (step: string, digest: unknown): { step: string; ref_json: string } => ({ step, ref_json: JSON.stringify({ digest }) });
const f = (platform: string): ReturnType<typeof emptyFacts> => emptyFacts(platform, `https://${platform}.example/me`, `https://${platform}.example/api`);

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

  it("orders by FACTS_STEPS, unknown steps last", () => {
    const out = readProfileFacts([row("zzz_other", [f("web")]), row("github_profile", [f("github")]), row("seed_profile", [f("linkedin")]), row("x_profile", [f("x")])]);
    expect(out.map((p) => p.platform)).toEqual(["linkedin", "x", "github", "web"]);
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
