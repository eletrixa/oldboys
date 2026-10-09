/**
 * Tests for the collectors' ProfileFacts digests (plans/012): numbers for merged accounts only.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/profile-facts-digest.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import type { Candidate } from "@/domain/claim";
import { ProfileFacts } from "@/domain/profile-facts";
import { github } from "@/recipe/sources/github";
import { instagram } from "@/recipe/sources/instagram";
import { harvestFacts, linkedinProfile } from "@/recipe/sources/linkedin";
import { x } from "@/recipe/sources/x";
import type { Fetched, StepContext } from "@/recipe/sources/types";
import { baseContext } from "@/recipe/__tests__/fakes";

function cand(platform: string, url: string, handle: string, decision: Candidate["decision"] = "merge"): Candidate {
  return { id: `c-${handle}`, run_id: "run-1", name: "Jana", profile_urls: [url], anchor_match: null, score: 0.9, decision, platform, handle, snippet: "", reasons: [] };
}
const f = (...payloads: unknown[]): Fetched[] => payloads.map((payload) => ({ req: { via: "fetch", url: "https://example.test/payload" }, payload }));
const merged = (platform: string, url: string, handle: string): StepContext => baseContext({ candidates: [cand(platform, url, handle)] });
const namesake = (platform: string, url: string, handle: string): StepContext => baseContext({ candidates: [cand(platform, url, handle, "possibly-same-as")] });

const tweet = { url: "https://x.com/jd/status/1", text: "hi", author: { userName: "jd", name: "Jana D", description: "builds things", followers: 1200, following: 80, createdAt: "Mon Mar 02 2015", profilePicture: "https://img/x.jpg", isBlueVerified: true } };
const ig = { username: "jd", fullName: "Jana D", biography: "photos", followersCount: 5000, followsCount: 300, postsCount: 42, verified: false, profilePicUrl: "https://img/ig.jpg" };
const ghUser = { login: "jd", html_url: "https://github.com/jd", name: "Jana D", bio: "dev", followers: 77, following: 5, created_at: "2015-03-02T10:00:00Z", avatar_url: "https://img/gh.png" };
const li = { linkedinUrl: "https://www.linkedin.com/in/jd", firstName: "Jana", lastName: "D", headline: "CTO", verified: true, premium: false, connectionsCount: 500, followerCount: 900, photo: "https://img/li.jpg", experience: [{ position: "CTO", companyName: "Acme", startDate: "Mar 2012" }, { position: "Dev", companyName: "Old", startDate: "2009-05" }] };

describe("x digest", () => {
  it("records the merged author once with the expected numbers", () => {
    const out = x.digest?.(f([tweet, { ...tweet, url: "https://x.com/jd/status/2" }]), merged("x", "https://x.com/jd", "jd")) as ProfileFacts[];
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ platform: "x", url: "https://x.com/jd", handle: "jd", followers: 1200, following: 80, created_at: "Mon Mar 02 2015", verified: true, photo_url: "https://img/x.jpg" });
    expect(ProfileFacts.safeParse(out[0]).success).toBe(true);
  });
  it("records nothing for a possibly-same-as candidate", () => {
    expect(x.digest?.(f([tweet]), namesake("x", "https://x.com/jd", "jd"))).toBeNull();
  });
});

describe("instagram digest", () => {
  it("records followers, following, posts", () => {
    const out = instagram.digest?.(f([ig]), merged("instagram", "https://www.instagram.com/jd/", "jd")) as ProfileFacts[];
    expect(out[0]).toMatchObject({ platform: "instagram", followers: 5000, following: 300, posts: 42, verified: false, handle: "jd" });
  });
  it("records nothing for a namesake", () => {
    expect(instagram.digest?.(f([ig]), namesake("instagram", "https://www.instagram.com/jd/", "jd"))).toBeNull();
  });
});

describe("github digest", () => {
  it("reads the user payload and ignores repo lists", () => {
    const out = github.digest?.(f(ghUser, [{ html_url: "https://github.com/jd/r", name: "r" }]), merged("github", "https://github.com/jd", "jd")) as ProfileFacts[];
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ platform: "github", handle: "jd", followers: 77, following: 5, created_at: "2015-03-02T10:00:00Z", display_name: "Jana D" });
  });
  it("records nothing for a namesake", () => {
    expect(github.digest?.(f(ghUser), namesake("github", "https://github.com/jd", "jd"))).toBeNull();
  });
});

describe("linkedin digest and harvestFacts", () => {
  it("records the merged profile", () => {
    const out = linkedinProfile.digest?.(f([li]), merged("linkedin", "https://www.linkedin.com/in/jd", "jd")) as ProfileFacts[];
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ platform: "linkedin", handle: "jd", display_name: "Jana D", bio: "CTO", connections: 500, followers: 900, verified: true, premium: false, earliest_experience_year: 2009 });
  });
  it("records nothing for a namesake", () => {
    expect(linkedinProfile.digest?.(f([li]), namesake("linkedin", "https://www.linkedin.com/in/jd", "jd"))).toBeNull();
  });
  it("reads the earliest year from both date styles and leaves absent flags null", () => {
    const f = harvestFacts({ linkedinUrl: "https://www.linkedin.com/in/a", experience: [{ startDate: "Mar 2012" }, { startDate: "2014-03" }], education: [], skills: [] });
    expect(f).toMatchObject({ earliest_experience_year: 2012, verified: null, connections: null, handle: "a" });
  });
});
