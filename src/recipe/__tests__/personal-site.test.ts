/**
 * Tests for the personal website collector: domain match, actor request, merged sources, own-writing gate.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/personal-site.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - personalDomains: diacritics, two- and three-part names, either order, hyphens, www, employer domains never match, cap of 2
 * - Collector: one actor request per domain against apify/website-content-crawler, nothing without a domain, pages merged
 * - sourceIdentityUpdates writes PERSONAL_SITE_REASON; gatePersonality counts the pages as own writing
 *
 * Design constraints:
 * - No network; fixtures are hand-written approximations of actor output
 */
import { describe, expect, it } from "vitest";
import type { Candidate, Source } from "@/domain/claim";
import { gatePersonality, PersonalityReading } from "@/recipe/seams/personality";
import { OWN_WRITING } from "@/recipe/seams/profile-gate";
import { sourceIdentityUpdates } from "@/recipe/seams/resolve";
import { PERSONAL_SITE_ACTOR, PERSONAL_SITE_REASON, personalDomains, personalSite } from "@/recipe/sources/personal-site";
import { baseContext } from "@/recipe/__tests__/fakes";
import type { Step } from "@/recipe/step";

const step = {} as Step;

function src(url: string, over: Partial<Source> = {}): Source {
  return { id: url, run_id: "run-1", url, actor: "apify/google-search-scraper", fetched_at: "t", excerpt: "", r2_key: "k", expires_at: "t", identity: "unverified", ...over };
}

describe("personalDomains", () => {
  it("matches the name with diacritics stripped, in either order, with hyphens, ignoring www", () => {
    const urls = ["https://www.robertvojacek.cz/about", "https://robert-vojacek.com/", "https://vojacekrobert.cz/cv", "https://josefburyan.com/"];
    expect(personalDomains("Robert Vojáček", urls)).toEqual(["robertvojacek.cz", "robert-vojacek.com"]);
    expect(personalDomains("Robert Vojáček", urls.slice(2))).toEqual(["vojacekrobert.cz"]);
    expect(personalDomains("Josef Buryan", urls)).toEqual(["josefburyan.com"]);
  });

  it("handles three-part names and subdomains", () => {
    expect(personalDomains("Jana Marie Dvořáková", ["https://blog.janamariedvorakova.cz/x", "https://janadvorakova.cz/"])).toEqual(["blog.janamariedvorakova.cz"]);
  });

  it("never matches employer or product domains, partial names, or a one-word subject", () => {
    expect(personalDomains("Robert Vojáček", ["https://revolt.bi/team", "https://vojacek.cz/", "https://www.linkedin.com/in/rvojacek", "not a url"])).toEqual([]);
    expect(personalDomains("Madonna", ["https://madonna.com/"])).toEqual([]);
  });
});

describe("personalSite collector", () => {
  const ctx = baseContext({
    subject: "Robert Vojáček",
    sources: [src("https://www.linkedin.com/in/rvojacek"), src("https://robertvojacek.cz/"), src("https://robertvojacek.cz/blog/1")],
  });

  it("asks the real crawler once per domain, from the homepage, 6 pages deep 1", () => {
    const reqs = personalSite.requests(ctx, step);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]).toMatchObject({
      via: "actor",
      actor: "apify/website-content-crawler",
      input: { startUrls: [{ url: "https://robertvojacek.cz/" }], maxCrawlPages: 6, maxCrawlDepth: 1 },
      maxTotalChargeUsd: 0.05,
      timeoutSecs: 45,
    });
  });

  it("reads a merged web candidate's url too, and nothing without a personal domain", () => {
    const cand: Candidate = { id: "c1", run_id: "run-1", name: "Robert Vojáček", profile_urls: ["https://vojacekrobert.cz/"], anchor_match: null, score: 0.9, decision: "merge", platform: "web", handle: null, snippet: "", reasons: [] };
    expect(personalSite.requests(baseContext({ subject: "Robert Vojáček", candidates: [cand] }), step).map((r) => (r.via === "actor" ? r.input.startUrls : null))).toEqual([[{ url: "https://vojacekrobert.cz/" }]]);
    expect(personalSite.requests(baseContext({ subject: "Robert Vojáček", sources: [src("https://revolt.bi/")] }), step)).toEqual([]);
    expect(personalSite.skipReason?.(ctx)).toMatch(/no website whose domain/);
  });

  it("files every crawled page as merged; the step actor is the own-writing label", () => {
    const out = personalSite.parse([{ url: "https://robertvojacek.cz/", text: "I build data platforms.", metadata: { title: "Robert" } }, { url: "https://robertvojacek.cz/cv", text: "" }], ctx, step);
    expect(out.map((p) => [p.url, p.identity, p.excerpt])).toEqual([
      ["https://robertvojacek.cz/", "merged", "Robert\nI build data platforms."],
      ["https://robertvojacek.cz/cv", "merged", ""],
    ]);
    expect(personalSite.parse({ nope: true }, ctx, step)).toEqual([]);
    expect(personalSite.id).toBe(PERSONAL_SITE_ACTOR);
    expect(OWN_WRITING.has(PERSONAL_SITE_ACTOR)).toBe(true);
  });

  it("sourceIdentityUpdates writes the personal-website reason and gatePersonality counts the page as own writing", () => {
    const page = src("https://robertvojacek.cz/", { id: "p1", actor: PERSONAL_SITE_ACTOR, identity: "merged", excerpt: "Robert\nI build data platforms. Small teams win." });
    expect(sourceIdentityUpdates([], [page, src("https://news.example/a")])).toEqual([{ id: "p1", identity: "merged", reason: PERSONAL_SITE_REASON }]);
    const reading = PersonalityReading.parse({
      disc: { type: "C", confidence: "low" },
      mbti: { type: "ISTJ", confidence: "low" },
      big5: null,
      read: "Builds.",
      traits: [],
      evidence: [{ quote: "Small teams win", source_id: "p1", kind: "INFERENCE", supports: true }],
    });
    expect(gatePersonality(reading, [page], []).evidence.map((e) => e.quote)).toEqual(["Small teams win"]);
  });
});
