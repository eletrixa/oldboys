/**
 * Tests for Source identity: which collector hits count as the subject ("merged") and which may be namesakes ("unverified").
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/sources-identity.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - identityFor(): profile-url prefix and handle-segment matches against merged candidates only
 * - every collector's parse() sets identity: merged for handle-driven fetches, unverified for name search and serp
 * - platformOf: the pasted CV pseudo-URL is "cv", not "web"
 *
 * Design constraints:
 * - No network; fixtures are minimal approximations of actor/API output
 */
import { describe, expect, it } from "vitest";
import type { Candidate } from "@/domain/claim";
import type { Step } from "@/recipe/step";
import { aresSearch, aresVr } from "@/recipe/sources/ares";
import { bluesky } from "@/recipe/sources/bluesky";
import { github } from "@/recipe/sources/github";
import { googleSearch } from "@/recipe/sources/google-search";
import { huggingface } from "@/recipe/sources/huggingface";
import { instagram } from "@/recipe/sources/instagram";
import { linkedinProfile, linkedinProfileDetail } from "@/recipe/sources/linkedin";
import { linkedinCompany } from "@/recipe/sources/linkedin-company";
import { openalex } from "@/recipe/sources/openalex";
import { orcid } from "@/recipe/sources/orcid";
import { stackexchange } from "@/recipe/sources/stackexchange";
import { tiktok } from "@/recipe/sources/tiktok";
import { identityFor, platformOf, type ParsedSource } from "@/recipe/sources/types";
import { websiteCrawler } from "@/recipe/sources/website";
import { x } from "@/recipe/sources/x";
import { youtube } from "@/recipe/sources/youtube";
import { baseContext } from "@/recipe/__tests__/fakes";

const step = {} as Step;

function cand(over: Partial<Candidate>): Candidate {
  return {
    id: "c1",
    run_id: "run-1",
    name: "Jana Dvořáková",
    profile_urls: [],
    anchor_match: null,
    score: 0.9,
    decision: "merge",
    platform: "web",
    handle: null,
    snippet: "",
    reasons: [],
    ...over,
  };
}

const merged = (over: Partial<Candidate>) => baseContext({ candidates: [cand(over)] });
const ids = (out: readonly ParsedSource[]) => out.map((p) => p.identity);

describe("identityFor", () => {
  it("matches profile url prefixes and handle segments of merged candidates only", () => {
    const ctx = baseContext({
      candidates: [
        cand({ platform: "web", profile_urls: ["https://www.jana.dev/"] }),
        cand({ id: "c2", platform: "github", handle: "jdvorakova" }),
        cand({ id: "c3", platform: "linkedin", decision: "possibly-same-as", profile_urls: ["https://www.linkedin.com/in/maybe"] }),
      ],
    });
    expect(identityFor(ctx, "https://jana.dev/blog/post")).toBe("merged");
    expect(identityFor(ctx, "https://github.com/JDvorakova/etl")).toBe("merged");
    expect(identityFor(ctx, "https://github.com/other/jdvorakova")).toBe("unverified");
    expect(identityFor(ctx, "https://www.linkedin.com/in/maybe")).toBe("unverified");
    expect(identityFor(ctx, "https://jana.dev.evil.com/")).toBe("unverified");
    expect(identityFor(ctx, "not a url")).toBe("unverified");
  });
});

describe("collector identity", () => {
  it("a {role_sites} serp step requests nothing without a role template and a site: clause with one", () => {
    const sitesStep = { ...step, query: '"{subject}" {role_sites}' };
    expect(googleSearch.requests(baseContext(), sitesStep)).toEqual([]);
    const [req] = googleSearch.requests(baseContext({ roleSites: ["github.com", "npmjs.com"] }), sitesStep);
    expect(req?.via === "actor" ? req.input.queries : null).toBe('"Jana Dvořáková" site:github.com OR site:npmjs.com');
  });

  it("serp hits are always unverified discovery", () => {
    const out = googleSearch.parse([{ organicResults: [{ url: "https://jana.dev/", title: "Jana" }] }], merged({ profile_urls: ["https://jana.dev/"] }), step);
    expect(ids(out)).toEqual(["unverified"]);
  });

  it("ares: the IČO anchor is merged, a name search hit is not", () => {
    const payload = { ekonomickeSubjekty: [{ ico: "12345678" }, { ico: "87654321" }] };
    expect(ids(aresSearch.parse(payload, baseContext({ anchor: "12345678" }), step))).toEqual(["merged", "unverified"]);
    expect(ids(aresSearch.parse(payload, baseContext(), step))).toEqual(["unverified", "unverified"]);
    const vr = { zaznamy: [{ ico: "12345678", statutarniOrgany: [{ clenoveOrganu: [{ fyzickaOsoba: { jmeno: "J", prijmeni: "D" } }] }] }] };
    expect(ids(aresVr.parse(vr, baseContext({ anchor: "12345678" }), step))).toEqual(["merged"]);
  });

  it("github: merged handle's repos are merged, name search users are not", () => {
    const repos = [{ html_url: "https://github.com/jd/etl", name: "etl" }];
    expect(ids(github.parse(repos, merged({ platform: "github", handle: "jd" }), step))).toEqual(["merged"]);
    expect(ids(github.parse({ items: [{ html_url: "https://github.com/jd", login: "jd" }] }, baseContext(), step))).toEqual(["unverified"]);
  });

  it("name-search collectors are unverified without a merged candidate", () => {
    const ctx = baseContext();
    expect(ids(stackexchange.parse({ items: [{ link: "https://stackoverflow.com/users/1/jd", display_name: "jd" }] }, ctx, step))).toEqual(["unverified"]);
    expect(ids(orcid.parse({ "expanded-result": [{ "orcid-id": "0000-0001-2345-6789" }] }, ctx, step))).toEqual(["unverified"]);
    expect(ids(openalex.parse({ results: [{ id: "https://openalex.org/A1", display_name: "Jana" }] }, ctx, step))).toEqual(["unverified"]);
    expect(ids(huggingface.parse([{ id: "jana-dvorakova/bert" }], ctx, step))).toEqual(["unverified"]);
    expect(ids(bluesky.parse({ actors: [{ handle: "dvorakova.bsky.social" }] }, ctx, step))).toEqual(["unverified"]);
  });

  it("huggingface and bluesky are merged for the merged handle", () => {
    expect(ids(huggingface.parse([{ id: "jd/bert" }], merged({ platform: "huggingface", handle: "jd" }), step))).toEqual(["merged"]);
    const bs = merged({ platform: "bluesky", handle: "dvorakova.bsky.social" });
    expect(ids(bluesky.parse({ actors: [{ handle: "dvorakova.bsky.social" }] }, bs, step))).toEqual(["merged"]);
  });

  it("instagram, x and tiktok: merged handle yes, possibly-same-as no", () => {
    const ig = [{ username: "jana" }];
    expect(ids(instagram.parse(ig, merged({ platform: "instagram", handle: "@jana" }), step))).toEqual(["merged"]);
    expect(ids(instagram.parse(ig, merged({ platform: "instagram", handle: "jana", decision: "possibly-same-as" }), step))).toEqual(["unverified"]);
    const tweets = [{ url: "https://x.com/jana/status/1", author: { userName: "jana" } }];
    expect(ids(x.parse(tweets, merged({ platform: "x", handle: "jana" }), step))).toEqual(["merged", "merged"]);
    const tt = [{ webVideoUrl: "https://www.tiktok.com/@jana/video/1" }];
    expect(ids(tiktok.parse(tt, merged({ platform: "tiktok", handle: "jana" }), step))).toEqual(["merged"]);
  });

  it("youtube: a merged channel vouches for its videos, a name search does not", () => {
    const vids = [{ url: "https://www.youtube.com/watch?v=1" }];
    expect(ids(youtube.parse(vids, merged({ platform: "youtube", profile_urls: ["https://www.youtube.com/@jana"] }), step))).toEqual(["merged"]);
    expect(ids(youtube.parse(vids, baseContext(), step))).toEqual(["unverified"]);
  });

  it("linkedin profile, detail and company match merged profile urls", () => {
    const ctx = merged({ platform: "linkedin", profile_urls: ["https://www.linkedin.com/in/jana/"] });
    expect(ids(linkedinProfile.parse([{ linkedinUrl: "https://linkedin.com/in/jana" }], ctx, step))).toEqual(["merged"]);
    expect(ids(linkedinProfileDetail.parse([{ basic_info: { public_identifier: "jana" } }], ctx, step))).toEqual(["merged"]);
    expect(ids(linkedinCompany.parse([{ linkedinUrl: "https://www.linkedin.com/company/acme" }], ctx, step))).toEqual(["unverified"]);
  });

  it("website: pages under a merged site are merged, excerpt-link crawls are not", () => {
    const pages = [{ url: "https://jana.dev/about" }, { url: "https://other.cz/" }];
    expect(ids(websiteCrawler.parse(pages, merged({ profile_urls: ["https://jana.dev"] }), step))).toEqual(["merged", "unverified"]);
  });
});

describe("platformOf", () => {
  it("returns cv for the pasted CV pseudo-URL, web for plain pages", () => {
    expect(platformOf("cv:run-1")).toBe("cv");
    expect(platformOf("https://cz.linkedin.com/in/josef-buryan")).toBe("linkedin");
    expect(platformOf("https://example.com/cv")).toBe("web");
  });
});
