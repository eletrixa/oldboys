  it("keeps a dotted Facebook username (jana.dvorakova.9) as a profile, drops a PHP page", () => {
    const fb = (facebook_url: string) =>
      tregPersonEnrich.parse({ person: { ...apollo.person, twitter_url: null, github_url: null, facebook_url } }, baseContext({ candidates: [linkedin()] }), step).map((s) => s.url);
    expect(fb("https://www.facebook.com/jana.dvorakova.9/")).toEqual(["https://www.facebook.com/jana.dvorakova.9"]);
    expect(fb("https://www.facebook.com/story.php?id=1")).toEqual([]);
  });

/**
 * Tests for the pre-lineup treg collectors: Apollo person enrichment and Exa people search.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/treg-search.test.ts
 * Deps:    vitest, src/recipe/seams/resolve (corroboration), src/recipe/__tests__/fakes (baseContext)
 * Tested:  src/recipe/sources/treg/person-enrich.ts, src/recipe/sources/treg/people-search.ts
 *
 * Key responsibilities:
 * - Request shape (endpoint, method, params, cost cap) and skip conditions
 * - Parse of payloads shaped like the treg catalog examples, namesake filtering, URL normalisation, digest, malformed payloads
 *
 * Design constraints:
 * - No network: fixtures follow the catalog example responses of apollo.people.enrich and exa.people.search
 */
import { describe, expect, it } from "vitest";
import type { Candidate } from "@/domain/claim";
import { tregPeopleSearch } from "@/recipe/sources/treg/people-search";
import { tregPersonEnrich } from "@/recipe/sources/treg/person-enrich";
import { corroboration } from "@/recipe/seams/resolve";
import { baseContext } from "./fakes";

const step = { id: "x", kind: "actor" as const };
const LI = "https://www.linkedin.com/in/jana-dvorakova/";
const linkedin = (over: Partial<Candidate> = {}): Candidate => ({
  id: "c1",
  run_id: "run-1",
  name: "Jana Dvořáková",
  profile_urls: [LI],
  anchor_match: null,
  score: 0.95,
  decision: "merge",
  platform: "linkedin",
  handle: "jana-dvorakova",
  snippet: "",
  reasons: [],
  ...over,
});

const apollo = {
  person: {
    id: "674a",
    name: "Jana Dvořáková",
    first_name: "Jana",
    last_name: "Dvořáková",
    linkedin_url: "http://www.linkedin.com/in/jana-dvorakova",
    title: "Senior Data Engineer",
    headline: "Data engineer at Kiwi",
    twitter_url: "http://twitter.com/janad/?ref=x",
    github_url: "https://github.com/janad/",
    facebook_url: null,
    email: "secret@example.com",
    personal_emails: ["a@b.cz"],
    city: "Brno",
    country: "Czechia",
    organization: { name: "Kiwi.com", primary_phone: { number: "1" } },
    employment_history: [
      { title: "Senior Data Engineer", organization_name: "Kiwi.com", start_date: "2021-03-01", end_date: null, emails: ["x@y.cz"] },
      { title: "Data Engineer", organization_name: "Red Hat", start_date: "2018-01-01", end_date: "2021-02-01" },
    ],
  },
};

describe("tregPersonEnrich", () => {
  it("enriches the merged LinkedIn profile with one capped POST and nothing else", () => {
    expect(tregPersonEnrich.requests(baseContext({ candidates: [linkedin()] }), step)).toEqual([
      { via: "treg", endpoint: "apollo.people.enrich", method: "POST", params: { linkedin_url: LI }, maxCostUsd: 0.03 },
    ]);
  });

  it("skips without a merged LinkedIn profile", () => {
    expect(tregPersonEnrich.requests(baseContext(), step)).toEqual([]);
    expect(tregPersonEnrich.requests(baseContext({ candidates: [linkedin({ decision: "possibly-same-as" })] }), step)).toEqual([]);
    expect(tregPersonEnrich.requests(baseContext({ candidates: [linkedin({ platform: "github", profile_urls: ["https://github.com/x"] })] }), step)).toEqual([]);
    expect(tregPersonEnrich.skipReason?.(baseContext())).toBe("no confirmed LinkedIn profile to enrich");
  });

  it("emits one source per social URL, with the name line and the confirmed LinkedIn URL literally", () => {
    const out = tregPersonEnrich.parse(apollo, baseContext({ candidates: [linkedin()] }), step);
    expect(out.map((s) => s.url)).toEqual(["https://x.com/janad", "https://github.com/janad"]);
    const lines = out[0]?.excerpt.split("\n") ?? [];
    expect(lines[0]).toBe("Jana Dvořáková – Data engineer at Kiwi");
    expect(lines[1]).toBe(`Linked from the confirmed LinkedIn profile ${LI} by Apollo people enrichment via treg`);
    expect(lines).toContain("Current: Senior Data Engineer at Kiwi.com");
    expect(lines).toContain("Location: Brno, Czechia");
    expect(lines).toContain("Senior Data Engineer @ Kiwi.com (2021-03-01–now)");
    expect(lines).toContain("Data Engineer @ Red Hat (2018-01-01–2021-02-01)");
    expect(out[0]?.identity).toBe("unverified");
  });

  it("keeps no contact or personal fields in raw", () => {
    const raw = JSON.stringify(tregPersonEnrich.parse(apollo, baseContext({ candidates: [linkedin()] }), step)[0]?.raw);
    expect(raw).not.toContain("secret@example.com");
    expect(raw).not.toContain("personal_emails");
    expect(raw).not.toContain("primary_phone");
    expect(raw).not.toContain("x@y.cz");
  });

  it("returns nothing for a missing person, no social URL or a malformed payload", () => {
    const ctx = baseContext({ candidates: [linkedin()] });
    expect(tregPersonEnrich.parse({ person: null }, ctx, step)).toEqual([]);
    expect(tregPersonEnrich.parse({ person: { ...apollo.person, twitter_url: null, github_url: "not a url" } }, ctx, step)).toEqual([]);
    expect(tregPersonEnrich.parse("nope", ctx, step)).toEqual([]);
    expect(tregPersonEnrich.parse(null, ctx, step)).toEqual([]);
    expect(tregPersonEnrich.parse({ person: { name: 5 } }, ctx, step)).toEqual([]);
  });

  it("yields the canonical profile URL for every host", () => {
    const urls = (twitter_url: string | null, github_url: string | null = null, facebook_url: string | null = null) =>
      tregPersonEnrich.parse({ person: { ...apollo.person, twitter_url, github_url, facebook_url } }, baseContext({ candidates: [linkedin()] }), step).map((s) => s.url);
    expect(urls("http://twitter.com/janad/?ref=x")).toEqual(["https://x.com/janad"]);
    expect(urls("https://www.x.com/janad/status/1")).toEqual(["https://x.com/janad"]);
    expect(urls(null, "https://www.github.com/janad")).toEqual(["https://github.com/janad"]);
    expect(urls(null, "https://github.com/janad/repo?tab=x")).toEqual(["https://github.com/janad"]);
    expect(urls(null, null, "https://www.facebook.com/janad/?ref=x")).toEqual(["https://www.facebook.com/janad"]);
    expect(urls(null, null, "http://www.facebook.com/profile.php?id=123&ref=x")).toEqual(["https://www.facebook.com/profile.php?id=123"]);
    expect(urls("https://Example.COM/Jana/?q=1#h")).toEqual(["https://example.com/Jana"]);
  });

  it("drops links without a profile handle", () => {
    const urls = (twitter_url: string, facebook_url: string | null = null) =>
      tregPersonEnrich.parse({ person: { ...apollo.person, twitter_url, github_url: null, facebook_url } }, baseContext({ candidates: [linkedin()] }), step);
    expect(urls("https://twitter.com/")).toEqual([]);
    expect(urls("garbage", "https://www.facebook.com/groups/123")).toEqual([]);
  });

  it("makes corroboration() report a cross-link to the merged LinkedIn candidate", () => {
    const ctx = baseContext({ candidates: [linkedin()] });
    const [src] = tregPersonEnrich.parse(apollo, ctx, step);
    if (src === undefined) throw new Error("no source");
    expect(corroboration(src, ctx)).toBe("cross-link");
  });

  it("digests provider, LinkedIn URL, accounts found, employer and title", () => {
    const ctx = baseContext({ candidates: [linkedin()] });
    const req = tregPersonEnrich.requests(ctx, step)[0];
    if (req === undefined) throw new Error("no request");
    expect(tregPersonEnrich.digest?.([{ req, payload: apollo }], ctx)).toEqual({
      provider: "apollo",
      linkedin_url: LI,
      found: [
        { platform: "x", url: "https://x.com/janad" },
        { platform: "github", url: "https://github.com/janad" },
      ],
      employer: "Kiwi.com",
      title: "Senior Data Engineer",
    });
    expect(tregPersonEnrich.digest?.([{ req, payload: { person: null } }], ctx)).toBeNull();
    expect(tregPersonEnrich.digest?.([], ctx)).toBeNull();
  });
});

const exa = {
  requestId: "0",
  results: [
    {
      id: "e1",
      title: "Jana Dvořáková",
      url: "https://cz.linkedin.com/in/jana-dvorakova-123?trk=x",
      entities: [
        {
          type: "person",
          properties: {
            name: "Jana Dvořáková",
            location: "Brno, Czechia",
            workHistory: [
              { title: "Senior Data Engineer", location: "Brno", dates: { from: "2021-03-01", to: null }, company: { name: "Kiwi.com" } },
              { title: "Data Engineer", dates: { from: "2018-01-01", to: "2021-02-01" }, company: { name: "Red Hat" } },
              "… 5 more item(s) truncated",
            ],
            educationHistory: [{ degree: "MSc" }],
          },
        },
      ],
    },
    { id: "e2", title: "Jana Dvořák", url: "https://www.linkedin.com/in/jana-dvorak/", entities: [{ properties: { name: "Jana Dvořák" } }] },
    { id: "e3", title: "Jana Dvořáková", url: "https://www.linkedin.com/company/acme/" },
    { id: "e4", title: "Jana Dvořáková", url: "https://example.com/jana" },
    { id: "e5", title: "Dvořáková, Jana", url: "https://www.linkedin.com/in/jana-dvorakova-123/", entities: [] },
  ],
};

describe("tregPeopleSearch", () => {
  it("searches name and anchor with one capped POST", () => {
    expect(tregPeopleSearch.requests(baseContext(), step)).toEqual([
      {
        via: "treg",
        endpoint: "exa.people.search",
        method: "POST",
        params: { query: "Jana Dvořáková Brno", category: "people", numResults: 5, includeDomains: ["linkedin.com"] },
        maxCostUsd: 0.01,
      },
    ]);
    expect(tregPeopleSearch.requests(baseContext({ anchor: "" }), step)[0]).toMatchObject({ params: { query: "Jana Dvořáková" } });
  });

  it("skips when a LinkedIn profile is merged or there is no name", () => {
    const merged = baseContext({ candidates: [linkedin()] });
    expect(tregPeopleSearch.requests(merged, step)).toEqual([]);
    expect(tregPeopleSearch.skipReason?.(merged)).toBe("a LinkedIn profile is already confirmed (given profile)");
    expect(tregPeopleSearch.requests(baseContext({ candidates: [linkedin({ decision: "rejected" })] }), step)).toHaveLength(1);
    const blank = baseContext({ subject: " " });
    expect(tregPeopleSearch.requests(blank, step)).toEqual([]);
    expect(tregPeopleSearch.skipReason?.(blank)).toBe("no name to search");
  });

  it("keeps LinkedIn profiles that spell the full name, drops namesakes and non-profiles, dedupes", () => {
    const out = tregPeopleSearch.parse(exa, baseContext(), step);
    expect(out.map((s) => s.url)).toEqual(["https://www.linkedin.com/in/jana-dvorakova-123"]);
    const lines = out[0]?.excerpt.split("\n") ?? [];
    expect(lines[0]).toBe("Jana Dvořáková – Senior Data Engineer @ Kiwi.com");
    expect(lines[1]).toBe('Found by Exa people search for "Jana Dvořáková Brno" via treg');
    expect(lines).toContain("Location: Brno, Czechia");
    expect(lines).toContain("Data Engineer @ Red Hat (2018-01-01–2021-02-01)");
    expect(out[0]?.identity).toBe("unverified");
  });

  it("returns nothing for malformed payloads", () => {
    expect(tregPeopleSearch.parse(null, baseContext(), step)).toEqual([]);
    expect(tregPeopleSearch.parse({ results: "x" }, baseContext(), step)).toEqual([]);
    expect(tregPeopleSearch.parse({ results: [{ nope: 1 }, 5] }, baseContext(), step)).toEqual([]);
  });

  const hit = (url: string, name: string | undefined, extra: Record<string, unknown> = {}, title?: string) => ({
    results: [{ url, ...(title === undefined ? {} : { title }), entities: name === undefined ? [] : [{ properties: { name, ...extra } }] }],
  });
  const parse = (payload: unknown) => tregPeopleSearch.parse(payload, baseContext(), step);

  it("accepts only linkedin.com and its subdomains", () => {
    expect(parse(hit("https://notlinkedin.com/in/xy", "Jana Dvořáková"))).toEqual([]);
    expect(parse(hit("https://linkedin.com.evil.io/in/x", "Jana Dvořáková"))).toEqual([]);
    expect(parse(hit("https://linkedin.com/in/xy", "Jana Dvořáková"))).toHaveLength(1);
  });

  it("drops LinkedIn paths that are not /in/", () => {
    expect(parse(hit("https://www.linkedin.com/company/acme", "Jana Dvořáková"))).toEqual([]);
    expect(parse(hit("https://www.linkedin.com/pulse/post-1", "Jana Dvořáková"))).toEqual([]);
    expect(parse(hit("https://www.linkedin.com/in/", "Jana Dvořáková"))).toEqual([]);
  });

  it("uses the entity name only, falling back to the title when the entity name is missing", () => {
    expect(parse(hit("https://www.linkedin.com/in/xy", "Petr Novák", {}, "Jana Dvořáková - CEO"))).toEqual([]);
    expect(parse(hit("https://www.linkedin.com/in/xy", undefined, {}, "Jana Dvořáková - CEO"))).toHaveLength(1);
    expect(parse(hit("https://www.linkedin.com/in/xy", "", {}, "Jana Dvořáková"))).toHaveLength(1);
    expect(parse(hit("https://www.linkedin.com/in/xy", undefined))).toEqual([]);
    expect(parse({ results: [{ url: "https://www.linkedin.com/in/xy", title: "Jana Dvořáková" }] })).toHaveLength(1);
  });

  it("omits missing parts of history lines", () => {
    const workHistory = [
      { title: "Analyst" },
      { company: { name: "Acme" }, dates: { from: "2019" } },
      { title: "Dev", company: { name: "Beta" }, dates: { to: "2020" } },
      { title: "CTO", company: { name: "Gamma" }, dates: { from: "2021" } },
    ];
    const lines = parse(hit("https://www.linkedin.com/in/xy", "Jana Dvořáková", { workHistory }))[0]?.excerpt.split("\n") ?? [];
    expect(lines).toContain("Analyst");
    expect(lines).toContain("Acme (2019–now)");
    expect(lines).toContain("Dev @ Beta");
    expect(lines).toContain("CTO @ Gamma (2021–now)");
    expect(lines.join("\n")).not.toMatch(/ @ $|^ @ |\(–/m);
  });

  it("handles a history of only truncation markers and caps history at 4 lines", () => {
    const only = parse(hit("https://www.linkedin.com/in/xy", "Jana Dvořáková", { workHistory: ["… 5 more item(s) truncated", 3] }));
    expect(only[0]?.excerpt.split("\n")[0]).toBe("Jana Dvořáková");
    const workHistory = Array.from({ length: 7 }, (_, n) => ({ title: `T${String(n)}`, company: { name: "C" } }));
    const lines = parse(hit("https://www.linkedin.com/in/xy", "Jana Dvořáková", { workHistory }))[0]?.excerpt.split("\n") ?? [];
    expect(lines.filter((l) => l.startsWith("T"))).toHaveLength(4);
  });
});
