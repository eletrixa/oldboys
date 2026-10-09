/**
 * Tests for the pre-lineup name searches on Instagram and Facebook.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/sources-search.test.ts
 * Deps:    vitest
 * Tested:  src/recipe/sources/instagram-search.ts, src/recipe/sources/facebook-search.ts, src/recipe/goals/hiring.ts (step order)
 *
 * Key responsibilities:
 * - Both searches run for every run without a confirmed account on the platform, and skip once one is confirmed
 * - Only accounts whose display name or handle spells the candidate's full name become sources; identity stays unverified
 * - The hiring recipe runs both searches before the lineup and one `site:` query per platform in social_serp
 *
 * Design constraints:
 * - No network: payload shapes are the actors' documented outputs (posts per account; page / profile results)
 */
import { describe, expect, it } from "vitest";
import type { Candidate } from "@/domain/claim";
import { hiringRecipe } from "@/recipe/goals/hiring";
import { facebookSearch } from "@/recipe/sources/facebook-search";
import { handleNamesSubject, instagramSearch } from "@/recipe/sources/instagram-search";
import { baseContext } from "./fakes";

const step = { id: "x", kind: "actor" as const };
const cand = (over: Partial<Candidate>): Candidate => ({
  id: "c1",
  run_id: "run-1",
  name: "Jana Dvořáková",
  profile_urls: [],
  anchor_match: null,
  score: 0.9,
  decision: "merge",
  platform: "instagram",
  handle: "jana",
  snippet: "",
  reasons: [],
  ...over,
});

describe("instagramSearch", () => {
  it("searches the name unless an Instagram account is already confirmed", () => {
    expect(instagramSearch.requests(baseContext(), step)).toEqual([
      { via: "actor", actor: "apify/instagram-scraper", input: { search: "Jana Dvořáková", searchType: "profile", searchLimit: 5, resultsLimit: 1 }, maxTotalChargeUsd: 0.03, timeoutSecs: 90 },
    ]);
    expect(instagramSearch.requests(baseContext({ candidates: [cand({ decision: "possibly-same-as" })] }), step)).toHaveLength(1);
    expect(instagramSearch.requests(baseContext({ candidates: [cand({})] }), step)).toEqual([]);
    expect(instagramSearch.requests(baseContext({ subject: " " }), step)).toEqual([]);
  });

  it("keeps one source per account that spells the full name, from posts or account items", () => {
    const out = instagramSearch.parse(
      [
        { ownerUsername: "jana.dvorakova", ownerFullName: "Jana Dvořáková", caption: "Data talk in Brno", url: "https://www.instagram.com/p/abc/" },
        { ownerUsername: "jana.dvorakova", ownerFullName: "Jana Dvořáková", caption: "second post" },
        { ownerUsername: "dvorakovaj", ownerFullName: "J. D.", caption: "no full name, handle without the first name" },
        { ownerUsername: "janadvorakova_", ownerFullName: "", caption: "handle spells the name" },
        { username: "jana_dvorak", fullName: "Jana Dvořák", biography: "namesake with another surname" },
        { username: "jdvorakova", fullName: "Dvořáková Jana", biography: "Engineer at Kiwi" },
      ],
      baseContext(),
      step,
    );
    expect(out.map((s) => s.url)).toEqual(["https://www.instagram.com/jana.dvorakova/", "https://www.instagram.com/janadvorakova_/", "https://www.instagram.com/jdvorakova/"]);
    expect(out[0]?.excerpt.split("\n")[0]).toBe("Jana Dvořáková");
    expect(out[0]?.excerpt).toContain("Post: Data talk in Brno");
    expect(out[0]?.identity).toBe("unverified");
    expect(out[2]?.excerpt).toContain("Engineer at Kiwi");
    expect(instagramSearch.parse({ error: "x" }, baseContext(), step)).toEqual([]);
  });

  it("handleNamesSubject reads initials and separators", () => {
    expect(handleNamesSubject("Jana Dvořáková", "jana.dvorakova")).toBe(true);
    expect(handleNamesSubject("Jana Dvořáková", "jdvorakova")).toBe(true);
    expect(handleNamesSubject("Jana Dvořáková", "dvorakova")).toBe(false);
    expect(handleNamesSubject("Jana", "jana")).toBe(false);
  });
});

describe("facebookSearch", () => {
  it("searches profiles unless a Facebook profile is already confirmed", () => {
    expect(facebookSearch.requests(baseContext(), step)).toEqual([
      { via: "actor", actor: "apify/facebook-search-scraper", input: { categories: ["Jana Dvořáková"], searchType: "profiles", resultsLimit: 5 }, maxTotalChargeUsd: 0.04, timeoutSecs: 90 },
    ]);
    expect(facebookSearch.requests(baseContext({ candidates: [cand({ platform: "facebook", handle: "jana.dvorakova" })] }), step)).toEqual([]);
  });

  it("keeps facebook.com results naming the candidate; never email or phone", () => {
    const out = facebookSearch.parse(
      [
        { facebookUrl: "https://www.facebook.com/jana.dvorakova.9/", title: "Jana Dvořáková | Brno", info: ["Data engineer at Kiwi.com", "Lives in Brno"], email: "j@example.com", phone: "+420 1" },
        { url: "https://www.facebook.com/profile.php?id=100001", name: "Dvořáková Jana", address: "Praha https://maps.google.com/x" },
        { facebookUrl: "https://www.facebook.com/someone.else/", title: "Someone Else" },
        { facebookUrl: "https://www.instagram.com/jana.dvorakova/", title: "Jana Dvořáková" },
      ],
      baseContext(),
      step,
    );
    expect(out.map((s) => s.url)).toEqual(["https://www.facebook.com/jana.dvorakova.9/", "https://www.facebook.com/profile.php?id=100001"]);
    expect(out[0]?.excerpt).toBe('Jana Dvořáková\nData engineer at Kiwi.com\nLives in Brno\nFound by Facebook people search for "Jana Dvořáková"');
    expect(JSON.stringify(out)).not.toContain("example.com");
    expect(JSON.stringify(out)).not.toContain("+420");
    expect(out[1]?.excerpt).toContain("Location: Praha");
    expect(out[1]?.excerpt).not.toContain("maps.google");
    expect(facebookSearch.parse("nope", baseContext(), step)).toEqual([]);
  });
});

describe("hiring recipe", () => {
  it("runs both name searches before the lineup and one site: query per platform", () => {
    const ids = hiringRecipe.steps.map((s) => s.id);
    const lineup = ids.indexOf("resolve_lineup");
    expect(ids.indexOf("instagram_search")).toBeLessThan(lineup);
    expect(ids.indexOf("facebook_search")).toBeLessThan(lineup);
    expect(ids.indexOf("instagram_profile")).toBeGreaterThan(lineup);
    expect(ids.indexOf("facebook_page")).toBeGreaterThan(lineup);
    const social = hiringRecipe.steps.find((s) => s.id === "social_serp")?.query ?? "";
    for (const site of ["site:instagram.com", "site:facebook.com", "site:github.com", "site:x.com"]) expect(social).toContain(site);
  });
});
