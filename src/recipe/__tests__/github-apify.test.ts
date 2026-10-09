/**
 * Tests for the Apify GitHub profile collector: request shape, count parsing, excerpt and digest.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/github-apify.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import type { Candidate } from "@/domain/claim";
import { baseContext } from "@/recipe/__tests__/fakes";
import { githubApify, parseCount } from "@/recipe/sources/github-apify";
import type { Step } from "@/recipe/step";

const step: Step = { id: "github_apify", kind: "actor", actor: "saswave/github-profile-scraper" };

function cand(platform: string, handle: string, id = handle): Candidate {
  return {
    id,
    run_id: "run-1",
    name: "Jana Dvořáková",
    profile_urls: [],
    anchor_match: null,
    score: 0.9,
    decision: "merge",
    platform,
    handle,
    snippet: "",
    reasons: [],
  };
}

const full = {
  user: "https://github.com/janad",
  name: "Jana D",
  followers: "1.2k",
  last_year_contribution_number: "1,444",
  first_year_commit: "2014",
  pinned_repos: [
    { name: "etl-kit", url: "https://github.com/janad/etl-kit", languages: ["Python", "SQL"], stars: "1.2k", forks: 30 },
    { name: "dotfiles", url: "https://github.com/janad/dotfiles", languages: [], stars: 3, forks: "x" },
  ],
  achievements: ["Arctic Code Vault Contributor", "Pull Shark"],
};

describe("githubApify.requests", () => {
  it("returns nothing for a non-technical family", () => {
    const ctx = baseContext({ roleFamily: "sales", candidates: [cand("github", "janad")] });
    expect(githubApify.requests(ctx, step)).toEqual([]);
  });

  it("returns nothing without a github handle", () => {
    const ctx = baseContext({ candidates: [cand("linkedin", "janad")] });
    expect(githubApify.requests(ctx, step)).toEqual([]);
  });

  it("returns one capped actor request for both handles, deduped", () => {
    const ctx = baseContext({
      candidates: [cand("github", "janad"), cand("github", "JanaD", "c2"), cand("github", "other", "c3"), cand("github", "third", "c4")],
    });
    expect(githubApify.requests(ctx, step)).toEqual([
      {
        via: "actor",
        actor: "saswave/github-profile-scraper",
        input: { peoples_links: ["https://github.com/janad", "https://github.com/other"] },
        maxTotalChargeUsd: 0.05,
        timeoutSecs: 45,
      },
    ]);
  });
});

describe("parseCount", () => {
  it.each([
    ["19.9k", 19900],
    ["1,444", 1444],
    ["11.3k", 11300],
    ["2.1m", 2100000],
    ["7", 7],
    [12, 12],
  ])("%s -> %s", (input, out) => {
    expect(parseCount(input)).toBe(out);
  });

  it.each([["n/a"], [""], [null], [undefined], [-1]])("%s -> null", (input) => {
    expect(parseCount(input)).toBeNull();
  });
});

describe("githubApify.parse", () => {
  const ctx = baseContext({ candidates: [cand("github", "janad")] });

  it("builds the excerpt sentence from a full item", () => {
    const [s] = githubApify.parse([full], ctx, step);
    expect(s?.url).toBe("https://github.com/janad");
    expect(s?.identity).toBe("merged");
    expect(s?.excerpt).toBe(
      "Jana D on GitHub: 1444 contributions in the last year; first commit in 2014; pinned repositories: etl-kit (★1200, Python), dotfiles (★3); achievements: Arctic Code Vault Contributor, Pull Shark; followers 1200",
    );
  });

  it("skips missing parts and falls back to the username", () => {
    const [s] = githubApify.parse([{ username: "janad", last_year_contribution_number: "5" }], ctx, step);
    expect(s?.excerpt).toBe("janad on GitHub: 5 contributions in the last year");
    expect(githubApify.parse([{ username: "x" }], ctx, step)[0]?.excerpt).toBe("x on GitHub");
  });

  it("returns [] for an unknown shape", () => {
    expect(githubApify.parse({ nope: 1 }, ctx, step)).toEqual([]);
    expect(githubApify.parse([{ name: "no handle" }], ctx, step)).toEqual([]);
  });
});

describe("githubApify.digest", () => {
  const ctx = baseContext({ candidates: [cand("github", "janad")] });

  it("parses numbers from strings", () => {
    expect(githubApify.digest?.([[{ username: "someone" }, full]], ctx)).toEqual({
      handle: "janad",
      last_year_contributions: 1444,
      first_commit_year: 2014,
      pinned_repos: [
        { name: "etl-kit", url: "https://github.com/janad/etl-kit", stars: 1200, forks: 30, languages: ["Python", "SQL"] },
        { name: "dotfiles", url: "https://github.com/janad/dotfiles", stars: 3, forks: 0, languages: [] },
      ],
      achievements: ["Arctic Code Vault Contributor", "Pull Shark"],
      source_url: "https://apify.com/saswave/github-profile-scraper?profile=janad",
    });
  });

  it("returns null without a matching item", () => {
    expect(githubApify.digest?.([[{ username: "someone" }]], ctx)).toBeNull();
    expect(githubApify.digest?.([], ctx)).toBeNull();
  });
});
