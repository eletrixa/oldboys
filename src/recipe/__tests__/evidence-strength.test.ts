/**
 * Evidence strength tests: self-authored sources are weak, independent ones strong, first-person press quotes weak.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/evidence-strength.test.ts
 * Deps:    vitest
 * Tested:  src/recipe/seams/evidence-strength.ts
 *
 * Key responsibilities:
 * - Own profile, posts, X, CV, own site and handle URLs are weak
 * - Press, employer page, ARES, GitHub records are strong; a first-person quote in press is weak and noted
 */
import { describe, expect, it } from "vitest";
import { evidenceStrength, SELF_QUOTED } from "@/recipe/seams/evidence-strength";

const me = [
  { platform: "web", handle: null, profile_urls: ["https://buryan.cz/about"] },
  { platform: "github", handle: "jburyan", profile_urls: ["https://github.com/jburyan"] },
  { platform: "youtube", handle: "@jbtalks", profile_urls: ["https://www.youtube.com/@jbtalks"] },
];
const press = "Firma loni zdvojnásobila tržby.";
const s = (actor: string, url: string, quote = press, candidates = me) => evidenceStrength({ actor, url }, quote, candidates);

describe("evidenceStrength", () => {
  it.each([
    ["harvestapi/linkedin-profile-scraper", "https://www.linkedin.com/in/jburyan"],
    ["harvestapi/linkedin-profile-posts", "https://www.linkedin.com/posts/jburyan_x"],
    ["apidojo/tweet-scraper", "https://x.com/jburyan/status/1"],
    ["rest/bluesky", "https://bsky.app/profile/jb"],
    ["apify/instagram-profile-scraper", "https://www.instagram.com/jb"],
    ["clockworks/tiktok-profile-scraper", "https://www.tiktok.com/@jb"],
    ["cv", "cv:run-1"],
    ["apify/website-content-crawler", "https://www.buryan.cz/blog/post"],
    ["streamers/youtube-scraper", "https://www.youtube.com/@jbtalks/videos"],
    ["apify/google-search-scraper", "https://www.linkedin.com/in/jburyan"],
  ])("%s %s is weak", (actor, url) => {
    expect(s(actor, url)).toEqual({ strength: "weak", note: "" });
  });

  it.each([
    ["apify/website-content-crawler", "https://www.e15.cz/byznys/buryan"],
    ["apify/google-search-scraper", "https://www.seznamzpravy.cz/clanek/x"],
    ["harvestapi/linkedin-company", "https://www.linkedin.com/company/acme"],
    ["ares/ekonomicke-subjekty-vr", "https://ares.gov.cz/ekonomicke-subjekty/res/123"],
    ["rest/github", "https://github.com/jburyan"],
    ["rest/openalex", "https://openalex.org/A1"],
    ["apify/website-content-crawler", "https://cloud.google.com/customers/acme"],
  ])("%s %s is strong", (actor, url) => {
    expect(s(actor, url)).toEqual({ strength: "strong", note: "" });
  });

  it("marks a first-person quote in press as self-quoted, weak", () => {
    for (const q of ["We doubled revenue last year", "Jsem hrdý na tým", "náš tým roste", "I built the platform"]) {
      expect(s("apify/website-content-crawler", "https://www.e15.cz/x", q)).toEqual({ strength: "weak", note: SELF_QUOTED });
    }
    expect(s("apify/website-content-crawler", "https://www.e15.cz/x", "Isolated systems, myriad users")).toEqual({ strength: "strong", note: "" });
  });

  it("without merged candidates a third-party site stays strong", () => {
    expect(s("apify/website-content-crawler", "https://buryan.cz/about", press, [])).toEqual({ strength: "strong", note: "" });
  });
});
