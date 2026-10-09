/**
 * Code profile tests: technical-family gate, defensive digest reading, fixed caveats.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/code-profile.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - `isTechnicalFamily` true for engineering and data only
 * - `readCodeProfile` returns the latest valid digest of step github_deep, null otherwise
 * - `CODE_PROFILE_CAVEATS` has 5 lines, none naming the person
 *
 * Design constraints:
 * - Pure, no I/O
 */
import { describe, expect, it } from "vitest";
import { APIFY_PROFILE_STEP, CODE_PROFILE_CAVEATS, CODE_PROFILE_STEP, codeTotals, isTechnicalFamily, isTechnicalRole, readCodeProfile, technicalSkipReason, type CodeProfile } from "@/domain/code-profile";

const digest = (handle: string): CodeProfile => ({
  handle,
  profile_url: `https://github.com/${handle}`,
  repos_owned: 2,
  forks_excluded: 1,
  stats_pending: [],
  repos: [],
  languages: [{ name: "TypeScript", repos: 1 }],
  stars_received: 3,
  merged_prs_elsewhere: 0,
  merged_prs_sample: [],
  recent_events: { pushes: 1, pull_requests: 0, issues: 0, reviews: 0, since: null },
  orgs: [],
  apify: null,
  account_created: null,
  sources: { user: `https://api.github.com/users/${handle}`, repos: `https://api.github.com/users/${handle}/repos`, search: "https://api.github.com/search/issues", events: `https://api.github.com/users/${handle}/events/public`, orgs: `https://api.github.com/users/${handle}/orgs` },
});
const apifyDigest = (handle: string) => ({ handle, last_year_contributions: 412, first_commit_year: 2015, pinned_repos: [], achievements: ["Arctic Code Vault Contributor"], source_url: "https://api.apify.com/v2/datasets/d1" });
const row = (ref: unknown, step: string = CODE_PROFILE_STEP) => ({ step, ref_json: typeof ref === "string" ? ref : JSON.stringify(ref) });

describe("isTechnicalFamily", () => {
  it("is true for engineering and data, false for others and null", () => {
    expect(isTechnicalFamily("engineering")).toBe(true);
    expect(isTechnicalFamily("data")).toBe(true);
    expect(isTechnicalFamily("marketing")).toBe(false);
    expect(isTechnicalFamily(null)).toBe(false);
  });
  it("names the skip reason for the others", () => {
    expect(technicalSkipReason({ roleFamily: "engineering", role: null })).toBeNull();
    expect(technicalSkipReason({ roleFamily: "sales", role: "Account Manager" })).toBe('role family "sales" is not technical');
    expect(technicalSkipReason({ roleFamily: null, role: null })).toContain("no role given");
  });
  it("isTechnicalRole accepts a technical title in a non-technical family", () => {
    expect(isTechnicalRole({ roleFamily: "product", role: "Product Engineer" })).toBe(true);
    expect(isTechnicalRole({ roleFamily: "operations", role: "Support Engineer" })).toBe(true);
    expect(isTechnicalRole({ roleFamily: "marketing", role: "Growth Lead" })).toBe(false);
    expect(technicalSkipReason({ roleFamily: "product", role: "Product Engineer" })).toBeNull();
  });
});

describe("readCodeProfile", () => {
  it("returns the latest valid digest", () => {
    const got = readCodeProfile([row({ digest: digest("old") }), row({ digest: digest("new") })]);
    expect(got?.handle).toBe("new");
  });

  it("skips a newer invalid row and falls back to an older valid one", () => {
    expect(readCodeProfile([row({ digest: digest("good") }), row({ digest: { handle: "x" } })])?.handle).toBe("good");
  });

  it("attaches the github_apify digest when handles match, case-insensitively", () => {
    const got = readCodeProfile([row({ digest: digest("Alice") }), row({ digest: apifyDigest("alice") }, APIFY_PROFILE_STEP)]);
    expect(got?.apify?.last_year_contributions).toBe(412);
  });

  it("ignores a github_apify digest of another handle or a malformed one", () => {
    expect(readCodeProfile([row({ digest: digest("alice") }), row({ digest: apifyDigest("bob") }, APIFY_PROFILE_STEP)])?.apify).toBeNull();
    expect(readCodeProfile([row({ digest: digest("alice") }), row({ digest: { handle: "alice" } }, APIFY_PROFILE_STEP)])?.apify).toBeNull();
  });

  it("returns null for no rows, other steps, malformed JSON and schema-failing digests", () => {
    expect(readCodeProfile([])).toBeNull();
    expect(readCodeProfile([row({ digest: digest("a") }, "github_profile")])).toBeNull();
    expect(readCodeProfile([row("{not json")])).toBeNull();
    expect(readCodeProfile([row({ digest: { handle: "x" } })])).toBeNull();
    expect(readCodeProfile([row({ nodigest: true })])).toBeNull();
    expect(readCodeProfile([{ step: CODE_PROFILE_STEP, ref_json: null }])).toBeNull();
  });
});

describe("CODE_PROFILE_CAVEATS", () => {
  it("has five lines and names no person", () => {
    expect(CODE_PROFILE_CAVEATS).toHaveLength(5);
    for (const line of CODE_PROFILE_CAVEATS) expect(line).not.toMatch(/\b(he|she|his|her|candidate|\{subject\})\b/i);
  });
});

describe("codeTotals", () => {
  it("sums the sampled repos", () => {
    const repo = { full_name: "a/b", url: "https://github.com/a/b", first_week: null, last_week: null, language: null, stars: 0, share: null, source_url: "https://api.github.com/repos/a/b/stats/contributors" };
    const p: CodeProfile = { ...digest("jd"), repos: [{ ...repo, commits: 10, additions: 100, deletions: 20 }, { ...repo, commits: 5, additions: 1, deletions: 2 }] };
    expect(codeTotals(p)).toEqual({ repos_sampled: 2, commits: 15, additions: 101, deletions: 22 });
    expect(codeTotals(digest("jd"))).toEqual({ repos_sampled: 0, commits: 0, additions: 0, deletions: 0 });
  });
});
