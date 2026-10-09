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
 * - Press, employer page, ARES, GitHub records are strong; a first-person quote in press is weak and noted unless it is
 *   plural only without his name (company statement, strong); Czech "my" is plural
 * - INFERENCE lines and non-merged sources are never strong
 */
import { describe, expect, it } from "vitest";
import { COMPANY_STATEMENT, evidenceStrength, SELF_QUOTED } from "@/recipe/seams/evidence-strength";

const me = [
  { name: "Josef Buryan", platform: "web", handle: null, profile_urls: ["https://buryan.cz/about"] },
  { name: "Josef Buryan", platform: "github", handle: "jburyan", profile_urls: ["https://github.com/jburyan"] },
  { name: "Josef Buryan", platform: "youtube", handle: "@jbtalks", profile_urls: ["https://www.youtube.com/@jbtalks"] },
  { name: "Josef Buryan", platform: "linkedin", handle: null, profile_urls: ["https://www.linkedin.com/in/josef-buryan"] },
];
const press = "Firma loni zdvojnásobila tržby.";
const s = (actor: string, url: string, quote = press, candidates = me) => evidenceStrength({ actor, url, identity: "merged" }, quote, candidates);

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
    ["apify/google-search-scraper", "https://cz.linkedin.com/posts/josef-buryan_thankyou-activity-1"],
    ["apify/google-search-scraper", "https://www.linkedin.com/posts/josef-buryan-activity-2"],
    ["apify/google-search-scraper", "https://www.linkedin.com/pulse/why-b2b-marketing-josef-buryan-1abc"],
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
    ["apify/google-search-scraper", "https://www.linkedin.com/posts/jana-novak_launch-activity-2"],
  ])("%s %s is strong", (actor, url) => {
    expect(s(actor, url)).toEqual({ strength: "strong", note: "" });
  });

  it("marks a singular first-person quote in press, or plural next to his name, as self-quoted, weak", () => {
    for (const q of ["Jsem hrdý na tým", "I built the platform", "my team doubled revenue", "Náš tým roste, říká Buryan", "We doubled revenue, says Josef"]) {
      expect(s("apify/website-content-crawler", "https://www.e15.cz/x", q)).toEqual({ strength: "weak", note: SELF_QUOTED });
    }
    expect(s("apify/website-content-crawler", "https://www.e15.cz/x", "Isolated systems, myriad users")).toEqual({ strength: "strong", note: "" });
  });

  it("plural first person alone in a press release is the company's voice: strong, noted", () => {
    for (const q of ["V Aktinu jsme nově obsadili pozici CMO.", "We doubled revenue last year", "náš tým roste", "Ale my rosteme"]) {
      expect(s("apify/website-content-crawler", "https://www.aktin.cz/tiskove-zpravy/cmo", q)).toEqual({ strength: "strong", note: COMPANY_STATEMENT });
    }
  });

  it("a self-authored source never carries the press note, first person or not", () => {
    expect(s("apify/google-search-scraper", "https://www.linkedin.com/in/josef-buryan", "Jsem CMO v Aktinu")).toEqual({ strength: "weak", note: "" });
    expect(s("apify/google-search-scraper", "https://www.linkedin.com/posts/josef-buryan_x", "We grew")).toEqual({ strength: "weak", note: "" });
  });

  it("never strong for an INFERENCE line or a source not tied to the merged identity", () => {
    const article = { actor: "apify/website-content-crawler", url: "https://www.e15.cz/x" };
    expect(evidenceStrength({ ...article, identity: "merged" }, press, me, "INFERENCE")).toEqual({ strength: "weak", note: "" });
    expect(evidenceStrength({ ...article, identity: "unverified" }, press, me)).toEqual({ strength: "weak", note: "" });
    expect(evidenceStrength({ ...article, identity: "merged" }, press, me, "FACT")).toEqual({ strength: "strong", note: "" });
  });

  it("without merged candidates a third-party site stays strong", () => {
    expect(s("apify/website-content-crawler", "https://buryan.cz/about", press, [])).toEqual({ strength: "strong", note: "" });
  });
});
