/**
 * Tests for the audience collectors: requests() gating and parse() mapping on inline fixtures.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/sources-audience.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Cover instagram, x, tiktok, youtube, bluesky collectors without network
 *
 * Design constraints:
 * - Fixtures stay tiny and inline; no network
 */
import { describe, expect, it } from "vitest";
import type { Candidate } from "@/domain/claim";
import type { Step } from "@/recipe/step";
import { bluesky } from "@/recipe/sources/bluesky";
import { instagram } from "@/recipe/sources/instagram";
import { tiktok } from "@/recipe/sources/tiktok";
import { x } from "@/recipe/sources/x";
import { youtube } from "@/recipe/sources/youtube";
import { baseContext } from "@/recipe/__tests__/fakes";

const step = {} as Step;

function cand(over: Partial<Candidate>): Candidate {
  return {
    id: "c1",
    run_id: "run-1",
    name: "Jana Dvořáková",
    profile_urls: ["https://example.com/jana"],
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

describe("instagram", () => {
  it("requests nothing without an instagram candidate", () => {
    expect(instagram.requests(baseContext(), step)).toEqual([]);
    expect(instagram.requests(baseContext({ candidates: [cand({ platform: "instagram", handle: "jana", decision: "rejected" })] }), step)).toEqual([]);
  });
  it("batches merge and possibly-same-as handles", () => {
    const ctx = baseContext({
      candidates: [
        cand({ platform: "instagram", handle: "@jana" }),
        cand({ id: "c2", platform: "instagram", handle: "jana2", decision: "possibly-same-as" }),
      ],
    });
    expect(instagram.requests(ctx, step)).toEqual([
      { via: "actor", actor: "apify/instagram-profile-scraper", input: { usernames: ["jana", "jana2"] }, maxTotalChargeUsd: 0.02, timeoutSecs: 45 },
    ]);
  });
  it("parses a profile with 3 captions", () => {
    const out = instagram.parse(
      [{ username: "jana", fullName: "Jana D", biography: "Data", followersCount: 10, verified: false, latestPosts: [1, 2, 3, 4].map((n) => ({ caption: `cap${String(n)}` })) }],
      baseContext(),
      step,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.url).toBe("https://www.instagram.com/jana/");
    expect(out[0]?.excerpt).toContain("Followers: 10");
    expect(out[0]?.excerpt).toContain("cap3");
    expect(out[0]?.excerpt).not.toContain("cap4");
  });
  it("returns [] on garbage", () => {
    expect(instagram.parse({ error: "x" }, baseContext(), step)).toEqual([]);
  });
});

describe("x", () => {
  it("gates on an x handle", () => {
    expect(x.requests(baseContext(), step)).toEqual([]);
    const r = x.requests(baseContext({ candidates: [cand({ platform: "x", handle: "@jana" })] }), step);
    expect(r).toEqual([
      { via: "actor", actor: "apidojo/tweet-scraper", input: { twitterHandles: ["jana"], maxItems: 20, sort: "Latest" }, maxTotalChargeUsd: 0.03, timeoutSecs: 45 },
    ]);
  });
  it("parses an author profile plus tweets", () => {
    const out = x.parse(
      [
        { url: "https://x.com/jana/status/1", text: "hello", createdAt: "2026-01-01", likeCount: 3, author: { userName: "jana", name: "Jana", description: "bio", followers: 99, createdAt: "2020" } },
        { url: "https://x.com/jana/status/2", text: "again" },
      ],
      baseContext(),
      step,
    );
    expect(out.map((s) => s.url)).toEqual(["https://x.com/jana", "https://x.com/jana/status/1", "https://x.com/jana/status/2"]);
    expect(out[0]?.excerpt).toContain("Followers: 99");
    expect(out[1]?.excerpt).toContain("3 likes");
  });
  it("returns [] on garbage", () => {
    expect(x.parse("nope", baseContext(), step)).toEqual([]);
  });
});

describe("tiktok", () => {
  it("gates on a tiktok handle", () => {
    expect(tiktok.requests(baseContext(), step)).toEqual([]);
    const r = tiktok.requests(baseContext({ candidates: [cand({ platform: "tiktok", handle: "jana" })] }), step);
    expect(r[0]).toMatchObject({ actor: "clockworks/tiktok-profile-scraper", input: { profiles: ["jana"], resultsPerPage: 5 }, maxTotalChargeUsd: 0.02 });
  });
  it("parses videos and falls back to a profile url", () => {
    const out = tiktok.parse(
      [
        { webVideoUrl: "https://www.tiktok.com/@jana/video/1", text: "dance", authorMeta: { name: "jana", signature: "sig", fans: 5 } },
        { authorMeta: { name: "jana" } },
        { text: "no author" },
      ],
      baseContext(),
      step,
    );
    expect(out.map((s) => s.url)).toEqual(["https://www.tiktok.com/@jana/video/1", "https://www.tiktok.com/@jana"]);
    expect(out[0]?.excerpt).toContain("fans: 5");
  });
});

describe("youtube", () => {
  it("uses the channel url when a candidate has one", () => {
    const ctx = baseContext({ candidates: [cand({ platform: "youtube", profile_urls: ["https://www.youtube.com/@jana"] })] });
    expect(youtube.requests(ctx, step)[0]).toMatchObject({ input: { startUrls: [{ url: "https://www.youtube.com/@jana" }], maxResults: 5 }, maxTotalChargeUsd: 0.03 });
  });
  it("falls back to searching the subject", () => {
    expect(youtube.requests(baseContext(), step)[0]).toMatchObject({ input: { searchQueries: ["Jana Dvořáková"], maxResults: 5 } });
  });
  it("parses videos", () => {
    const out = youtube.parse([{ url: "https://www.youtube.com/watch?v=1", title: "Talk", channelName: "Jana", viewCount: 100, date: "2026-01-01", text: "x".repeat(900) }], baseContext(), step);
    expect(out[0]?.excerpt).toContain("Talk");
    expect(out[0]?.excerpt).toContain("views: 100");
    expect(out[0]?.excerpt.length).toBeLessThan(700);
  });
});

describe("bluesky", () => {
  it("builds the public search url", () => {
    expect(bluesky.requests(baseContext(), step)).toEqual([
      { via: "fetch", url: "https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=Jana%20Dvo%C5%99%C3%A1kov%C3%A1&limit=5" },
    ]);
  });
  it("parses actors", () => {
    const out = bluesky.parse(
      {
        actors: [
          { handle: "jana.bsky.social", displayName: "Jana Dvorakova", description: "hi" },
          { handle: "someone.bsky.social", displayName: "Jana Novak", description: "fuzzy match without the surname" },
        ],
      },
      baseContext(),
      step,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ url: "https://bsky.app/profile/jana.bsky.social" });
    expect(out[0]?.excerpt).toBe("Jana Dvorakova (@jana.bsky.social)\nhi");
    expect(bluesky.parse(null, baseContext(), step)).toEqual([]);
  });
});
