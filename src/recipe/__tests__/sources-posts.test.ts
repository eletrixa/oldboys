/**
 * Tests for the profile-voice collectors: LinkedIn posts, Facebook pages, and the hiring employer company page.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/sources-posts.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - requests(): merged candidates only, verified input fields; parse(): inline fixtures, identity per author / link
 * - Hiring employer page: taken from the merged LinkedIn profile's "Employer page:" line, never by name search
 *
 * Design constraints:
 * - No network; fixtures are hand-written approximations of actor output
 */
import { describe, expect, it } from "vitest";
import type { Candidate, Source } from "@/domain/claim";
import { facebookPage } from "@/recipe/sources/facebook";
import { employerPages, linkedinProfile } from "@/recipe/sources/linkedin";
import { linkedinCompany } from "@/recipe/sources/linkedin-company";
import { linkedinPosts } from "@/recipe/sources/linkedin-posts";
import { baseContext } from "@/recipe/__tests__/fakes";
import type { Step } from "@/recipe/step";

const step = {} as Step;

function cand(over: Partial<Candidate>): Candidate {
  return {
    id: "c1", run_id: "run-1", name: "Jana Dvořáková", profile_urls: ["https://www.linkedin.com/in/jana"], anchor_match: null, score: 0.9,
    decision: "merge", platform: "linkedin", handle: "jana", snippet: "", reasons: [], ...over,
  };
}

describe("linkedinPosts", () => {
  it("asks for the merged profile's own posts only", () => {
    expect(linkedinPosts.requests(baseContext({ candidates: [cand({ decision: "possibly-same-as" })] }), step)).toEqual([]);
    expect(linkedinPosts.requests(baseContext({ candidates: [cand({})] }), step)).toEqual([
      {
        via: "actor",
        actor: "harvestapi/linkedin-profile-posts",
        input: { targetUrls: ["https://www.linkedin.com/in/jana"], maxPosts: 10, includeReposts: false, scrapeReactions: false, scrapeComments: false },
        maxTotalChargeUsd: 0.03,
        timeoutSecs: 45,
      },
    ]);
  });

  it("parses posts; the subject's own are merged, others' and empty ones are not kept as the subject", () => {
    const ctx = baseContext({ candidates: [cand({})] });
    const out = linkedinPosts.parse(
      [
        { linkedinUrl: "https://www.linkedin.com/posts/jana_dbt-activity-1", content: "Shipping our dbt migration.", author: { publicIdentifier: "jana" }, postedAt: { date: "2026-09-01T10:00:00Z" }, engagement: { likes: 12, comments: 3 } },
        { linkedinUrl: "https://www.linkedin.com/posts/other_x-activity-2", content: "Not hers.", author: { publicIdentifier: "other" } },
        { linkedinUrl: "https://www.linkedin.com/posts/jana_img-activity-3", content: "" },
      ],
      ctx,
      step,
    );
    expect(out.map((s) => s.identity)).toEqual(["merged", "unverified"]);
    expect(out[0]?.excerpt).toBe("LinkedIn post, 2026-09-01 · 12 likes, 3 comments\nShipping our dbt migration.");
    expect(out[1]?.excerpt.length).toBeLessThanOrEqual(600);
    expect(linkedinPosts.parse({ nope: 1 }, ctx, step)).toEqual([]);
  });
});

describe("facebookPage", () => {
  it("asks only for merged facebook candidates", () => {
    const fb = cand({ platform: "facebook", profile_urls: ["https://www.facebook.com/janadata"], handle: "janadata" });
    expect(facebookPage.requests(baseContext({ candidates: [{ ...fb, decision: "possibly-same-as" }] }), step)).toEqual([]);
    expect(facebookPage.requests(baseContext({ candidates: [fb] }), step)).toEqual([
      { via: "actor", actor: "apify/facebook-pages-scraper", input: { startUrls: [{ url: "https://www.facebook.com/janadata" }] }, maxTotalChargeUsd: 0.03, timeoutSecs: 45 },
    ]);
  });

  it("parses public page fields and never keeps email or phone", () => {
    const ctx = baseContext({ candidates: [cand({ platform: "facebook", profile_urls: ["https://www.facebook.com/janadata"], handle: "janadata" })] });
    const out = facebookPage.parse(
      [{ facebookUrl: "https://www.facebook.com/janadata", title: "Jana Data", categories: ["Page", "Blogger"], intro: "Data talks in Brno", followers: 420, email: "jana@example.com", phone: "+420 1" }],
      ctx,
      step,
    );
    expect(out[0]).toMatchObject({ url: "https://www.facebook.com/janadata", identity: "merged" });
    expect(out[0]?.excerpt).toBe("Jana Data\nCategories: Page, Blogger\nData talks in Brno\nFollowers: 420");
    expect(JSON.stringify(out[0]?.raw)).not.toContain("jana@example.com");
  });
});

describe("hiring employer company page", () => {
  const harvest = [
    {
      linkedinUrl: "https://www.linkedin.com/in/jana",
      firstName: "Jana",
      experience: [{ position: "Data Engineer", companyName: "Kiwi.com", companyLinkedinUrl: "https://www.linkedin.com/company/kiwi-com/" }],
    },
  ];
  const ctxWith = (identity: Source["identity"]) => {
    const parsed = linkedinProfile.parse(harvest, baseContext({ candidates: [cand({})] }), step)[0];
    const s: Source = { id: "s1", run_id: "run-1", url: parsed?.url ?? "", actor: "harvestapi/linkedin-profile-scraper", fetched_at: "t", excerpt: parsed?.excerpt ?? "", r2_key: "k", expires_at: "e", identity };
    return baseContext({ candidates: [cand({})], sources: [s] });
  };

  it("writes the current employer's page into the profile excerpt and reads it back from merged profiles only", () => {
    expect(ctxWith("merged").sources[0]?.excerpt).toContain("Employer page: https://www.linkedin.com/company/kiwi-com/");
    expect(employerPages(ctxWith("merged").sources)).toEqual(["https://www.linkedin.com/company/kiwi-com/"]);
    expect(employerPages(ctxWith("unverified").sources)).toEqual([]);
  });

  it("requests that page in hiring, nothing without it, and marks it merged", () => {
    expect(linkedinCompany.requests(ctxWith("unverified"), step)).toEqual([]);
    const ctx = ctxWith("merged");
    expect(linkedinCompany.requests(ctx, step)[0]).toMatchObject({ actor: "harvestapi/linkedin-company", input: { companies: ["https://www.linkedin.com/company/kiwi-com/"] } });
    const out = linkedinCompany.parse([{ linkedinUrl: "https://www.linkedin.com/company/kiwi-com", name: "Kiwi.com" }, { linkedinUrl: "https://www.linkedin.com/company/other" }], ctx, step);
    expect(out.map((s) => s.identity)).toEqual(["merged", "unverified"]);
  });
});
