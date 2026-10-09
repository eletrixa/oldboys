/**
 * Tests for the rest/github-deep collector: requests, follow-up, parse excerpts and the CodeProfile digest.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/github-deep.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { CodeProfile, codeTotals } from "@/domain/code-profile";
import type { Candidate } from "@/domain/claim";
import { githubDeep, kindOf } from "@/recipe/sources/github-deep";
import type { CollectorRequest, Fetched, ParsedSource, StepContext } from "@/recipe/sources/types";
import type { Step } from "@/recipe/step";
import { baseContext } from "@/recipe/__tests__/fakes";

const step: Step = { id: "github_deep", kind: "actor", actor: "rest/github-deep" };
const parse: (p: unknown, c: StepContext, s: Step, r?: CollectorRequest) => ParsedSource[] = githubDeep.parse;

function cand(handle: string): Candidate {
  return { id: `c-${handle}`, run_id: "run-1", name: "Jana", profile_urls: [`https://github.com/${handle}`], anchor_match: null, score: 0.9, decision: "merge", platform: "github", handle, snippet: "", reasons: [] };
}
const urls = (reqs: readonly CollectorRequest[]): string[] => reqs.map((r) => (r.via === "fetch" ? r.url : "actor"));
const req = (url: string): CollectorRequest => ({ via: "fetch", url });
const fx = (url: string, payload: unknown): Fetched => ({ req: req(url), payload });
const A = "https://api.github.com";
const U = {
  user: `${A}/users/jd`,
  repos: `${A}/users/jd/repos?type=owner&sort=pushed&per_page=100`,
  search: `${A}/search/issues?q=author%3Ajd+type%3Apr+is%3Amerged+-user%3Ajd&per_page=10`,
  events: `${A}/users/jd/events/public?per_page=100`,
  orgs: `${A}/users/jd/orgs`,
  stats: (name: string) => `${A}/repos/jd/${name}/stats/contributors`,
};
const ctx1 = baseContext({ candidates: [cand("jd")] });

const repo = (owner: string, name: string, over: Record<string, unknown> = {}) => ({ name, html_url: `https://github.com/${owner}/${name}`, owner: { login: owner }, fork: false, archived: false, pushed_at: "2026-01-01T00:00:00Z", stargazers_count: 2, language: "TypeScript", size: 10, ...over });
const WEEK = 1704585600; // 2024-01-07
const stats = [
  { total: 30, author: { login: "other" }, weeks: [{ w: WEEK, a: 5, d: 1, c: 30 }] },
  { total: 10, author: { login: "JD" }, weeks: [{ w: WEEK - 604800, a: 0, d: 0, c: 0 }, { w: WEEK, a: 100, d: 20, c: 4 }, { w: WEEK + 604800, a: 50, d: 5, c: 6 }] },
];
const user = { login: "jd", html_url: "https://github.com/jd", name: "Jana", created_at: "2015-03-02T10:00:00Z" };
const search = { total_count: 93, items: [{ title: "Fix leak", html_url: "https://github.com/acme/lib/pull/9", repository_url: "https://api.github.com/repos/acme/lib", user: { login: "jd" }, pull_request: { merged_at: "2024-05-01T00:00:00Z" } }] };

describe("kindOf", () => {
  it("classifies the six request kinds and names the handle or repo", () => {
    expect(kindOf(U.user)).toEqual({ kind: "user", handle: "jd" });
    expect(kindOf(U.repos)).toEqual({ kind: "repos", handle: "jd" });
    expect(kindOf(U.search)).toEqual({ kind: "search", handle: "jd" });
    expect(kindOf(U.events)).toEqual({ kind: "events", handle: "jd" });
    expect(kindOf(U.orgs)).toEqual({ kind: "orgs", handle: "jd" });
    expect(kindOf(U.stats("etl"))).toEqual({ kind: "stats", repo: "jd/etl" });
  });
  it("decodes the handle and rejects other URLs", () => {
    expect(kindOf(`${A}/users/j%C3%A1/orgs`)).toEqual({ kind: "orgs", handle: "já" });
    expect(kindOf(`${A}/users/jd/starred`)).toBeNull();
    expect(kindOf("https://example.com/users/jd")).toBeNull();
    expect(kindOf("not a url")).toBeNull();
  });
});

describe("githubDeep requests", () => {
  it("asks for nothing on a non-technical family and says so", () => {
    const ctx = baseContext({ roleFamily: "marketing", role: "Brand Manager", candidates: [cand("jd")] });
    expect(githubDeep.requests(ctx, step)).toEqual([]);
    expect(githubDeep.skipReason?.(ctx)).toBe('role family "marketing" is not technical');
    expect(githubDeep.skipReason?.(ctx1)).toBeNull();
  });
  it("asks for nothing without a handle", () => {
    expect(githubDeep.requests(baseContext(), step)).toEqual([]);
  });
  it("builds the five first-wave URLs", () => {
    expect(urls(githubDeep.requests(ctx1, step))).toEqual([
      "https://api.github.com/users/jd",
      "https://api.github.com/users/jd/repos?type=owner&sort=pushed&per_page=100",
      "https://api.github.com/search/issues?q=author%3Ajd+type%3Apr+is%3Amerged+-user%3Ajd&per_page=10",
      "https://api.github.com/users/jd/events/public?per_page=100",
      "https://api.github.com/users/jd/orgs",
    ]);
  });
  it("dedupes handles case-insensitively and caps at two", () => {
    const ctx = baseContext({ candidates: [cand("jd"), cand("JD"), cand("b"), cand("c")] });
    expect(githubDeep.requests(ctx, step)).toHaveLength(10);
  });
});

describe("githubDeep followUp", () => {
  it("picks the six newest own, active, non-empty repos", () => {
    const repos = [
      ...Array.from({ length: 7 }, (_, i) => repo("jd", `r${String(i)}`, { pushed_at: `2026-0${String(i + 1)}-01T00:00:00Z` })),
      repo("jd", "fork", { fork: true, pushed_at: "2030-01-01T00:00:00Z" }),
      repo("jd", "old", { archived: true, pushed_at: "2030-01-01T00:00:00Z" }),
      repo("jd", "empty", { size: 0, pushed_at: "2030-01-01T00:00:00Z" }),
    ];
    const out = urls(githubDeep.followUp?.(ctx1, step, [fx(U.user, user), fx(U.repos, repos)]) ?? []);
    expect(out).toEqual(["r6", "r5", "r4", "r3", "r2", "r1"].map((n) => `https://api.github.com/repos/jd/${n}/stats/contributors`));
  });
});

describe("githubDeep parse", () => {
  it("states the stats numbers in one exact sentence", () => {
    const out = parse(stats, ctx1, step, req(U.stats("etl")));
    expect(out).toHaveLength(1);
    expect(out[0]?.url).toBe("https://github.com/jd/etl/graphs/contributors");
    expect(out[0]?.excerpt).toBe("jd/etl: jd made 10 commits, +150 lines added, −25 lines removed, between 2024-01-07 and 2024-01-14 (share of all commits 25%)");
    expect(out[0]?.identity).toBe("merged");
  });
  it("keeps only the handle's row in raw, plus the all-authors commit total", () => {
    const out = parse(stats, ctx1, step, req(U.stats("etl")));
    expect(out[0]?.raw).toEqual({ ...stats[1], total_commits_all_authors: 40 });
    const none = parse([stats[0]], ctx1, step, req(U.stats("etl")));
    expect(none[0]?.raw).toEqual({ total_commits_all_authors: 30 });
    expect(none[0]?.excerpt).toContain("made 0 commits");
  });
  it("parses a pending (null) stats payload to nothing", () => {
    expect(parse(null, ctx1, step, req(U.stats("etl")))).toEqual([]);
  });
  it("parses nothing without a recognised request", () => {
    expect(parse(user, ctx1, step)).toEqual([]);
    expect(parse(user, ctx1, step, req("https://example.com/x"))).toEqual([]);
  });
  it("summarises repos, merged PRs, events and orgs", () => {
    const repos = parse([repo("jd", "a"), repo("jd", "b", { language: "Go", stargazers_count: 3 }), repo("jd", "c", { fork: true })], ctx1, step, req(U.repos));
    expect(repos[0]?.url).toBe("https://github.com/jd?tab=repositories");
    expect(repos[0]?.excerpt).toBe("3 public repositories owned, 1 fork excluded, languages: Go (1 repo), TypeScript (1 repo), 5 stars received across own repos");
    expect(parse(search, ctx1, step, req(U.search))[0]?.excerpt).toBe("93 pull requests by jd merged outside their own account (GitHub's count; may include their organisations' repositories), e.g. acme/lib: Fix leak (merged 2024-05-01)");
    const events = [{ type: "PushEvent", created_at: "2026-09-01T00:00:00Z", actor: { login: "jd" } }, { type: "PushEvent", created_at: "2026-08-01T00:00:00Z" }, { type: "PullRequestEvent", created_at: "2026-09-02T00:00:00Z" }];
    expect(parse(events, ctx1, step, req(U.events))[0]?.excerpt).toBe("last 90 days of public activity: 2 pushes, 1 pull request, 0 issues, 0 reviews, since 2026-08-01");
    const full = Array.from({ length: 100 }, () => ({ type: "PushEvent", created_at: "2026-09-01T00:00:00Z" }));
    expect(parse(full, ctx1, step, req(U.events))[0]?.excerpt).toBe("the 100 most recent public events: 100 pushes, 0 pull requests, 0 issues, 0 reviews, since 2026-09-01");
    const orgs = parse([{ login: "acme" }, { login: "oss" }], ctx1, step, req(U.orgs));
    expect(orgs[0]?.url).toBe("https://api.github.com/users/jd/orgs");
    expect(orgs[0]?.excerpt).toBe("member of organizations: acme, oss");
    expect(parse(user, ctx1, step, req(U.user))[0]?.excerpt).toContain("account created 2015-03-02");
  });
  it("returns [] for unknown shapes", () => {
    expect(parse("nope", ctx1, step, req(U.repos))).toEqual([]);
    expect(parse([], ctx1, step, req(U.repos))).toEqual([]);
  });
});

describe("githubDeep search owner filter", () => {
  it("drops OWNER and MEMBER items from count and sample", () => {
    const item = (assoc: string, n: number) => ({ title: `t${String(n)}`, html_url: `https://github.com/o/r/pull/${String(n)}`, repository_url: "https://api.github.com/repos/o/r", user: { login: "jd" }, author_association: assoc, pull_request: { merged_at: "2024-05-01T00:00:00Z" } });
    const p = { total_count: 3, items: [item("OWNER", 1), item("MEMBER", 2), item("CONTRIBUTOR", 3)] };
    expect(parse(p, ctx1, step, req(U.search))[0]?.excerpt).toBe("1 pull request by jd merged into repositories of others, e.g. o/r: t3 (merged 2024-05-01)");
    const d = githubDeep.digest?.([fx(U.user, user), fx(U.search, p)], ctx1) as CodeProfile;
    expect(d.merged_prs_elsewhere).toBe(1);
    expect(d.merged_prs_sample).toHaveLength(1);
  });
});

describe("githubDeep digest", () => {
  const repos = [repo("jd", "etl", { pushed_at: "2026-03-01T00:00:00Z" }), repo("jd", "web", { pushed_at: "2026-02-01T00:00:00Z", language: "Go", stargazers_count: 5 }), repo("jd", "fk", { fork: true })];
  const events = [{ type: "PushEvent", created_at: "2026-09-01T00:00:00Z", actor: { login: "jd" } }];
  const pairs = [fx(U.user, user), fx(U.repos, repos), fx(U.search, search), fx(U.events, events), fx(U.orgs, [{ login: "acme" }]), fx(U.stats("etl"), stats), fx(U.stats("web"), null)];

  it("sums only ready repos and lists pending ones", () => {
    const d = githubDeep.digest?.(pairs, ctx1) as CodeProfile;
    expect(d.repos_owned).toBe(3);
    expect(d.forks_excluded).toBe(1);
    expect(codeTotals(d)).toEqual({ repos_sampled: 1, commits: 10, additions: 150, deletions: 25 });
    expect(d.repos[0]?.full_name).toBe("jd/etl");
    expect(d.repos[0]?.share).toBeCloseTo(0.25);
    expect(d.stats_pending).toEqual(["jd/web"]);
    expect(d.stars_received).toBe(7);
    expect(d.merged_prs_elsewhere).toBe(93);
    expect(d.merged_prs_sample[0]?.repo).toBe("acme/lib");
    expect(d.recent_events.pushes).toBe(1);
    expect(d.orgs).toEqual(["acme"]);
    expect(d.account_created).toBe("2015-03-02T10:00:00Z");
    expect(d.sources).toEqual({ user: U.user, repos: U.repos, search: U.search, events: U.events, orgs: U.orgs });
    expect(d.repos[0]?.source_url).toBe(U.stats("etl"));
  });
  it("validates against CodeProfile", () => {
    expect(CodeProfile.safeParse(githubDeep.digest?.(pairs, ctx1)).success).toBe(true);
  });
  it("reports a repo as pending when its stats request is missing or null", () => {
    const d = githubDeep.digest?.([fx(U.user, user), fx(U.repos, repos), fx(U.stats("web"), stats)], ctx1) as CodeProfile;
    expect(d.repos.map((r) => r.full_name)).toEqual(["jd/web"]);
    expect(d.stats_pending).toEqual(["jd/etl"]);
  });
  it("returns null without a user payload", () => {
    expect(githubDeep.digest?.([fx(U.repos, repos), fx(U.search, search)], ctx1)).toBeNull();
  });
});
