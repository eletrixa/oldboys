/**
 * Tests for the LinkedIn profile/company and website collectors.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/sources-web.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - requests(): URL/input assertions, empty when nothing to ask; parse(): inline fixtures
 *
 * Design constraints:
 * - No network; fixtures are hand-written approximations of actor output
 */
import { describe, expect, it } from "vitest";
import type { Candidate, Source } from "@/domain/claim";
import { linkedinCompany } from "@/recipe/sources/linkedin-company";
import { linkedinProfile, linkedinProfileDetail } from "@/recipe/sources/linkedin";
import { websiteCrawler } from "@/recipe/sources/website";
import type { StepContext } from "@/recipe/sources/types";
import { baseContext } from "@/recipe/__tests__/fakes";
import type { Step } from "@/recipe/step";

const step = {} as Step;

function cand(over: Partial<Candidate>): Candidate {
  return {
    id: "c1",
    run_id: "run-1",
    name: "Jana Dvořáková",
    profile_urls: ["https://cz.linkedin.com/in/jana-dvorakova-data"],
    anchor_match: null,
    score: 0.9,
    decision: "merge",
    platform: "linkedin",
    handle: null,
    snippet: "",
    reasons: [],
    ...over,
  };
}

function src(url: string, excerpt = ""): Source {
  return { id: "s1", run_id: "run-1", url, actor: "x", fetched_at: "t", excerpt, r2_key: "k", expires_at: "t", identity: "unverified" };
}

const withCands = (c: Candidate[]): StepContext => baseContext({ candidates: c });

describe("linkedinProfile", () => {
  it("asks once for all merge/possibly-same-as linkedin urls", () => {
    const ctx = withCands([
      cand({}),
      cand({ id: "c2", decision: "possibly-same-as", profile_urls: ["https://www.linkedin.com/in/jana2"] }),
      cand({ id: "c3", decision: "rejected", profile_urls: ["https://www.linkedin.com/in/nope"] }),
      cand({ id: "c4", platform: "github", profile_urls: ["https://github.com/j"] }),
    ]);
    const reqs = linkedinProfile.requests(ctx, step);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]).toMatchObject({
      via: "actor",
      actor: "harvestapi/linkedin-profile-scraper",
      input: { urls: ["https://cz.linkedin.com/in/jana-dvorakova-data", "https://www.linkedin.com/in/jana2"], profileScraperMode: "Profile details no email ($4 per 1k)" },
      maxTotalChargeUsd: 0.05,
      timeoutSecs: 45,
    });
  });

  it("returns [] without linkedin candidates", () => {
    expect(linkedinProfile.requests(baseContext(), step)).toEqual([]);
    expect(linkedinProfileDetail.requests(baseContext(), step)).toEqual([]);
  });

  it("parses a profile", () => {
    const out = linkedinProfile.parse(
      [
        {
          linkedinUrl: "https://www.linkedin.com/in/jana",
          firstName: "Jana",
          lastName: "Dvořáková",
          headline: "Data Engineer",
          location: { linkedinText: "Brno, Czechia" },
          experience: [{ position: "Data Engineer", companyName: "Kiwi.com", startDate: { text: "2021" }, endDate: { text: "Present" } }],
          education: [{ schoolName: "VUT Brno", degree: "MSc" }],
          skills: [{ name: "dbt" }, { name: "Airflow" }],
        },
      ],
      baseContext(),
      step,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.url).toBe("https://www.linkedin.com/in/jana");
    expect(out[0]?.excerpt).toContain("Jana Dvořáková");
    expect(out[0]?.excerpt).toContain("Data Engineer @ Kiwi.com (2021–Present)");
    expect(out[0]?.excerpt).toContain("VUT Brno, MSc");
    expect(out[0]?.excerpt).toContain("Skills: 2");
    expect(linkedinProfile.parse({ nope: 1 }, baseContext(), step)).toEqual([]);
  });
});

describe("linkedinProfileDetail", () => {
  it("makes one request per url with username", () => {
    const reqs = linkedinProfileDetail.requests(withCands([cand({})]), step);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]).toMatchObject({ actor: "apimaestro/linkedin-profile-detail", input: { username: "https://cz.linkedin.com/in/jana-dvorakova-data" } });
  });

  it("parses basic_info/experience/education", () => {
    const out = linkedinProfileDetail.parse(
      [
        {
          basic_info: { fullname: "Jana D", headline: "DE", location: { full: "Brno" }, public_identifier: "jana" },
          experience: [{ title: "Engineer", company: "Kiwi", start_date: { year: 2020 }, is_current: true }],
          education: [{ school: "VUT", degree: "BSc", field_of_study: "CS" }],
        },
      ],
      baseContext(),
      step,
    );
    expect(out[0]?.url).toBe("https://www.linkedin.com/in/jana");
    expect(out[0]?.excerpt).toContain("Engineer @ Kiwi (2020–present)");
    expect(out[0]?.excerpt).toContain("VUT, BSc, CS");
  });
});

describe("linkedinCompany", () => {
  it("returns [] for hiring", () => {
    expect(linkedinCompany.requests(baseContext(), step)).toEqual([]);
  });

  it("uses company urls from sources, else searches by subject", () => {
    const dd = { goal: "due-diligence" as const, subject: "Acme s.r.o." };
    const withUrl = linkedinCompany.requests(baseContext({ ...dd, sources: [src("https://www.linkedin.com/company/acme")] }), step);
    expect(withUrl[0]).toMatchObject({ actor: "harvestapi/linkedin-company", input: { companies: ["https://www.linkedin.com/company/acme"] } });
    const bySearch = linkedinCompany.requests(baseContext(dd), step);
    expect(bySearch[0]).toMatchObject({ input: { searches: ["Acme s.r.o."] } });
  });

  it("parses a company", () => {
    const out = linkedinCompany.parse(
      [
        {
          linkedinUrl: "https://www.linkedin.com/company/acme",
          name: "Acme",
          industries: [{ name: "Software" }],
          employeeCountRange: { start: 51, end: 200 },
          foundedOn: { year: 2015 },
          description: "We build things.",
          locations: [{ parsed: { text: "Brno, Czechia" }, headquarter: true }],
        },
      ],
      baseContext(),
      step,
    );
    expect(out[0]?.excerpt).toContain("Industry: Software");
    expect(out[0]?.excerpt).toContain("Size: 51–200");
    expect(out[0]?.excerpt).toContain("HQ: Brno, Czechia");
    expect(out[0]?.excerpt).toContain("Founded: 2015");
  });
});

describe("websiteCrawler", () => {
  it("returns [] with nothing to crawl", () => {
    expect(websiteCrawler.requests(baseContext({ sources: [src("https://github.com/x", "see https://github.com/x")] }), step)).toEqual([]);
  });

  it("collects web candidates and non-social excerpt links, max 3", () => {
    const ctx = baseContext({
      candidates: [cand({ platform: "web", profile_urls: ["https://jana.dev"] }), cand({ id: "c2", platform: "web", decision: "rejected", profile_urls: ["https://bad.example"] })],
      sources: [src("https://github.com/j", "Blog: https://blog.jana.dev/. Also https://twitter.com/j and https://a.example https://b.example")],
    });
    const reqs = websiteCrawler.requests(ctx, step);
    expect(reqs[0]).toMatchObject({
      actor: "apify/website-content-crawler",
      input: {
        startUrls: [{ url: "https://jana.dev" }, { url: "https://blog.jana.dev/" }, { url: "https://a.example" }],
        maxCrawlPages: 5,
        maxCrawlDepth: 1,
        saveMarkdown: false,
        crawlerType: "cheerio",
      },
      maxTotalChargeUsd: 0.05,
    });
  });

  it("parses pages", () => {
    const out = websiteCrawler.parse([{ url: "https://jana.dev", text: "x".repeat(5000), metadata: { title: "Jana" } }], baseContext(), step);
    expect(out[0]?.excerpt.startsWith("Jana\nxxx")).toBe(true);
    expect(out[0]?.excerpt.length).toBeLessThan(1900);
  });
});
