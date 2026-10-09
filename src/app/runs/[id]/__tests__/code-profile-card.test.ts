/**
 * Tests for the code contributions text: separators, sums, source links, pending line, caveats, no profile.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/code-profile-card.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - fmtInt thin-space separators; statGroups sums and source links; codeProfileLines content, order and null case
 *
 * Design constraints:
 * - Pure: fixed `now`, synthetic profile
 */
import { describe, expect, it } from "vitest";
import { CODE_PROFILE_CAVEATS, type CodeProfile } from "@/domain/code-profile";
import { codeProfileLines, fmtInt, PENDING_PREFIX, statGroups } from "../code-profile-text";

const NOW = new Date("2026-10-09T00:00:00Z");
const profile: CodeProfile = {
  handle: "jnovak",
  profile_url: "https://github.com/jnovak",
  repos_owned: 5,
  forks_excluded: 3,
  stats_pending: ["jnovak/slow"],
  repos: [
    {
      full_name: "jnovak/tool", url: "https://github.com/jnovak/tool", commits: 1234, additions: 1_200_000, deletions: 45_000,
      first_week: "2020-W01", last_week: "2024-W10", language: "Go", stars: 1500, share: 0.85,
      source_url: "https://api.github.com/repos/jnovak/tool/stats/contributors",
    },
  ],
  languages: [{ name: "Go", repos: 2 }],
  stars_received: 1500,
  merged_prs_elsewhere: 4,
  merged_prs_sample: [{ repo: "org/lib", title: "Fix leak", url: "https://github.com/org/lib/pull/9", merged_at: null }],
  recent_events: { pushes: 10, pull_requests: 2, issues: 1, reviews: 3, since: null },
  orgs: ["acme"],
  apify: {
    handle: "jnovak", last_year_contributions: 2400, first_commit_year: 2013, achievements: ["Arctic Code Vault Contributor"],
    pinned_repos: [{ name: "tool", url: "https://github.com/jnovak/tool", stars: 1500, forks: 20, languages: ["Go"] }],
    source_url: "https://api.apify.com/v2/datasets/abc/items",
  },
  account_created: "2014-03-02T10:00:00Z",
  sources: {
    user: "https://api.github.com/users/jnovak",
    repos: "https://api.github.com/users/jnovak/repos?per_page=100",
    search: "https://api.github.com/search/issues?q=author:jnovak",
    events: "https://api.github.com/users/jnovak/events/public",
    orgs: "https://api.github.com/users/jnovak/orgs",
  },
};

describe("code profile text", () => {
  it("separates thousands with a thin space", () => {
    expect(fmtInt(1_200_000)).toBe("1 200 000");
    expect(fmtInt(999)).toBe("999");
  });

  it("links each group to its source and drops non-http(s) sources", () => {
    const src = (p: CodeProfile) => Object.fromEntries(statGroups(p, NOW).map((g) => [g.label, g.source]));
    expect(src(profile)["Own repositories"]).toBe(profile.sources.repos);
    expect(src(profile)["PRs merged elsewhere"]).toContain("search/issues");
    expect(src(profile)["Public events, last 90 days"]).toContain("/events");
    expect(src(profile)["Account age"]).toBe(profile.sources.user);
    expect(src({ ...profile, sources: { ...profile.sources, events: "javascript:alert(1)" } })["Public events, last 90 days"]).toBeNull();
  });

  it("builds the stat row with sums, minus sign and account age", () => {
    const by = Object.fromEntries(statGroups(profile, NOW).map((g) => [g.label, g.value]));
    expect(by["Own repositories"]).toBe("1 sampled of 5 owned");
    expect(by.Commits).toBe("1 234");
    expect(by.Lines).toBe("+1 200 000 / −45 000");
    expect(by["Account age"]).toBe("12 years (since 2014-03-02)");
  });

  it("writes lines with repos, PR sample, orgs, profile-page numbers, pending line and every caveat", () => {
    const lines = codeProfileLines(profile, NOW);
    expect(lines[0]).toContain("jnovak");
    expect(lines.some((l) => l.startsWith("Repo jnovak/tool: 1 234 commits") && l.includes("85%"))).toBe(true);
    expect(lines).toContain("Merged PR in org/lib: Fix leak (https://github.com/org/lib/pull/9)");
    expect(lines).toContain("Organizations: acme");
    expect(lines.some((l) => l.startsWith("From the GitHub profile page (via Apify), contributions in the last year: 2\u2009400"))).toBe(true);
    expect(lines).toContain("Pinned repo tool: 1\u2009500 stars, 20 forks, Go (https://github.com/jnovak/tool)");
    expect(lines).toContain(`${PENDING_PREFIX}jnovak/slow`);
    for (const c of CODE_PROFILE_CAVEATS) expect(lines).toContain(`- ${c}`);
  });

  it("omits the pending line when nothing is pending and returns [] without a profile", () => {
    expect(codeProfileLines({ ...profile, stats_pending: [] }, NOW).some((l) => l.startsWith(PENDING_PREFIX))).toBe(false);
    expect(codeProfileLines(null)).toEqual([]);
  });
});
