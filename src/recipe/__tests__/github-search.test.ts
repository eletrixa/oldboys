/**
 * Tests for the GitHub name search before the lineup (rest/github-search) and its place in the hiring recipe.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/github-search.test.ts
 * Deps:    vitest, src/recipe/sources/github-search, src/recipe/goals/hiring, ./fakes
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - requests: technical role and no confirmed GitHub account -> one user search; otherwise nothing with a truthful skipReason
 * - followUp: the listing's first MAX_HITS logins become profile requests
 * - parse: one unverified Source per profile that spells the full name; the listing itself and namesakes yield nothing
 * - hiring recipe: github_search runs before resolve_lineup
 */
import { describe, expect, it } from "vitest";
import type { Candidate } from "@/domain/claim";
import { hiringRecipe } from "@/recipe/goals/hiring";
import { githubSearch, MAX_HITS, searchUrl, userUrl } from "@/recipe/sources/github-search";
import type { Step } from "@/recipe/step";
import { baseContext } from "@/recipe/__tests__/fakes";

const step: Step = { id: "github_search", kind: "actor", actor: "rest/github-search" };

const merged: Candidate = {
  id: "c1",
  run_id: "run-1",
  name: "Jana Dvořáková",
  anchor_match: null,
  score: 1,
  decision: "merge",
  platform: "github",
  handle: "janadv",
  snippet: "",
  profile_urls: ["https://github.com/janadv"],
  reasons: [],
};

describe("githubSearch.requests", () => {
  it("searches the name for a technical role without a confirmed GitHub account", () => {
    expect(githubSearch.requests(baseContext(), step)).toEqual([{ via: "fetch", url: searchUrl("Jana Dvořáková") }]);
  });

  it("does nothing for a non-technical role, a confirmed account or an empty name", () => {
    const sales = baseContext({ role: "Account Manager", roleFamily: "sales" });
    expect(githubSearch.requests(sales, step)).toEqual([]);
    expect(githubSearch.skipReason?.(sales)).toMatch(/not technical/);
    const done = baseContext({ candidates: [merged] });
    expect(githubSearch.requests(done, step)).toEqual([]);
    expect(githubSearch.skipReason?.(done)).toMatch(/already confirmed/);
    expect(githubSearch.requests(baseContext({ subject: " " }), step)).toEqual([]);
  });
});

describe("githubSearch.followUp and parse", () => {
  const listing = { req: { via: "fetch" as const, url: searchUrl("Jana Dvořáková") }, payload: { items: [{ login: "janadv" }, { login: "jdvorakova" }, { login: "janad" }, { login: "extra" }] } };

  it("asks for the first MAX_HITS profiles of the listing", () => {
    const reqs = githubSearch.followUp?.(baseContext(), step, [listing]) ?? [];
    expect(reqs).toHaveLength(MAX_HITS);
    expect(reqs[0]).toEqual({ via: "fetch", url: userUrl("janadv") });
    expect(githubSearch.followUp?.(baseContext(), step, [{ req: listing.req, payload: { message: "rate limited" } }])).toEqual([]);
  });

  it("keeps a profile spelling the full name as an unverified source, drops the listing and namesakes", () => {
    const ctx = baseContext();
    expect(githubSearch.parse(listing.payload, ctx, step)).toEqual([]);
    const user = { login: "janadv", html_url: "https://github.com/janadv", name: "Jana Dvořáková", company: "@acme", location: "Brno", bio: null, blog: "https://janadv.cz", public_repos: 12, created_at: "2019-03-04T10:00:00Z" };
    const out = githubSearch.parse(user, ctx, step);
    expect(out).toHaveLength(1);
    expect(out[0]?.url).toBe("https://github.com/janadv");
    expect(out[0]?.identity).toBe("unverified");
    expect(out[0]?.excerpt.split("\n")).toEqual(["Jana Dvořáková", "@janadv", "@acme", "Brno", "https://janadv.cz", "12 public repos, joined 2019-03-04", 'Found by GitHub user search for "Jana Dvořáková"']);
    expect(githubSearch.parse({ ...user, login: "jdvorakova", name: null }, ctx, step)).toHaveLength(1);
    expect(githubSearch.parse({ ...user, login: "pepa", name: "Petr Dvořák" }, ctx, step)).toEqual([]);
  });
});

describe("hiring recipe", () => {
  it("runs the GitHub name search before the lineup, like the Instagram and Facebook searches", () => {
    const ids = hiringRecipe.steps.map((s) => s.id);
    expect(ids.indexOf("github_search")).toBeGreaterThan(-1);
    expect(ids.indexOf("github_search")).toBeLessThan(ids.indexOf("resolve_lineup"));
    expect(ids.indexOf("github_profile")).toBeGreaterThan(ids.indexOf("resolve_lineup"));
  });
});
