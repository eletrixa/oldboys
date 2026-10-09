/**
 * Tests for the treg social-verify collector: request gating per platform, parse of the six catalog payloads, digest.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/treg-social-verify.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - requests(): exact endpoint, method, params, cap; max 6; dedupe; no handle or no merged candidate gives []
 * - parse(): URL, numbers in the excerpt, no sensitive field, not-found and malformed give []
 * - digest(): ProfileFacts of merged accounts with a token-free source_url
 *
 * Design constraints:
 * - Fixtures are trimmed copies of the catalog example responses; no network
 */
import { describe, expect, it } from "vitest";
import type { Candidate } from "@/domain/claim";
import type { Step } from "@/recipe/step";
import { tregSocialVerify as c } from "@/recipe/sources/treg/social-verify";
import type { CollectorRequest, Fetched } from "@/recipe/sources/types";
import { baseContext } from "@/recipe/__tests__/fakes";

const step = {} as Step;
const cand = (platform: string, handle: string | null, url: string, over: Partial<Candidate> = {}): Candidate => ({
  id: `c-${platform}`, run_id: "run-1", name: "Jana Dvořáková", profile_urls: [url], anchor_match: null, score: 0.9,
  decision: "merge", platform, handle, snippet: "", reasons: [], ...over,
});
const LI = "https://www.linkedin.com/in/jana";
const FB = "https://www.facebook.com/jana.page";
const all = [
  cand("linkedin", "jana", LI), cand("instagram", "@jana", "https://www.instagram.com/jana/"), cand("tiktok", "jana", "https://www.tiktok.com/@jana"),
  cand("x", "jana", "https://x.com/jana"), cand("youtube", "jana", "https://www.youtube.com/@jana"), cand("facebook", null, FB),
];
const ctx = baseContext({ candidates: all });
const treg = (endpoint: string, method: "GET" | "POST", params: Record<string, string>): CollectorRequest => ({ via: "treg", endpoint, method, params, maxCostUsd: 0.005 });

const payloads: Record<string, unknown> = {
  "fetchinio.linkedin.user.profile": {
    id: "urn:li:fsd_profile:A", firstName: "Jana", lastName: "Dvořáková", title: "Head of Growth", description: "Growth lead in Brno.",
    profilePictureUrl: "https://media.licdn.com/p.jpg", premium: true, isVerified: false, openToWork: false, followerCount: 4100, connectionsCount: 500,
    joinDate: { month: 5, year: 2013 }, experiences: [{ dateRange: "2018 - Present" }, { dateRange: "2011 - 2018" }],
  },
  "tikhub.instagram.user.profile": {
    code: 200, data: { data: { user: { username: "jana", full_name: "Jana D", biography: "Brno", is_verified: false, profile_pic_url: "https://i/p.jpg",
      edge_followed_by: { count: 1234 }, edge_follow: { count: 56 }, edge_owner_to_timeline_media: { count: 78, page_info: {} } } } },
  },
  "tikhub.tiktok.user.profile": {
    data: { userInfo: { user: { uniqueId: "jana", nickname: "Jana", signature: "videos", verified: false, createTime: 1425144149, avatarLarger: "https://t/a.jpg" },
      stats: { followerCount: 9500, followingCount: 12, videoCount: 148, heart: 5 } } },
  },
  "anyapi.x.user.profile": { output: { found: true, data: { avatarUrl: "https://x/a.jpg", bio: "Marketing", displayName: "Jana", followers: 321, following: 45, handle: "jana", tweets: 6789, verified: true } } },
  "scrapecreators.youtube.channel.profile": {
    success: true, channelId: "UC-9-kyTW8ZkZNDHQJ6FgpwQ", isVerified: false, name: "Jana TV", description: "Channel", subscriberCount: 2500, videoCount: 33,
    joinedDateText: "Joined Sep 24, 2013", avatar: { image: { sources: [{ url: "https://yt/a.jpg", width: 68 }] } },
  },
  "scrapecreators.x.v1-facebook-profile": {
    success: true, id: "100088017857524", name: "Jana Page", url: FB, creationDate: "November 25, 2022", gender: "FEMALE", email: "a@b.cz", phone: "+420111",
    address: "Brno", followerCount: 777, likeCount: 700, category: "Marketing agency", website: "https://jana.cz",
  },
};
const reqOf = (platform: string): CollectorRequest => {
  const r = c.requests(ctx, step).find((x) => x.via === "treg" && x.endpoint.includes(platform === "facebook" ? "facebook" : platform));
  if (r === undefined) throw new Error(platform);
  return r;
};

describe("treg/social-verify requests", () => {
  it("builds one capped request per platform with the catalog's method and params", () => {
    expect(c.requests(ctx, step)).toEqual([
      treg("fetchinio.linkedin.user.profile", "GET", { profileUrlOrUrn: LI }),
      treg("tikhub.instagram.user.profile", "GET", { username: "jana" }),
      treg("tikhub.tiktok.user.profile", "GET", { uniqueId: "jana" }),
      treg("anyapi.x.user.profile", "POST", { handle: "jana" }),
      treg("scrapecreators.youtube.channel.profile", "GET", { handle: "jana" }),
      treg("scrapecreators.x.v1-facebook-profile", "GET", { url: FB, cache_max_age: "7d" }),
    ]);
  });
  it("passes a UC id as channelId, dedupes, skips a missing handle and unconfirmed candidates", () => {
    const uc = "UC-9-kyTW8ZkZNDHQJ6FgpwQ";
    const r = c.requests(baseContext({ candidates: [
      cand("youtube", uc, `https://www.youtube.com/channel/${uc}`), cand("x", "Jana", "https://x.com/Jana"), cand("x", "@jana", "https://x.com/jana", { id: "c2" }),
      cand("instagram", null, "https://www.instagram.com/z/"), cand("tiktok", "t", "https://www.tiktok.com/@t", { decision: "possibly-same-as" }),
    ] }), step);
    expect(r).toEqual([treg("scrapecreators.youtube.channel.profile", "GET", { channelId: uc }), treg("anyapi.x.user.profile", "POST", { handle: "Jana" })]);
  });
  it("collapses the same handle on one platform in any case but keeps other platforms apart", () => {
    const r = c.requests(baseContext({ candidates: [
      cand("youtube", "JanaTV", "https://www.youtube.com/@JanaTV"), cand("youtube", "janatv", "https://www.youtube.com/@janatv", { id: "c2" }),
      cand("x", "janatv", "https://x.com/janatv", { id: "c3" }),
    ] }), step);
    expect(r.map((x) => (x.via === "treg" ? x.endpoint : ""))).toEqual(["scrapecreators.youtube.channel.profile", "anyapi.x.user.profile"]);
  });
  it("cuts seven merged candidates to six requests", () => {
    const seven = Array.from({ length: 7 }, (_, i) => cand("x", `h${String(i)}`, `https://x.com/h${String(i)}`, { id: `c${String(i)}` }));
    expect(c.requests(baseContext({ candidates: seven }), step)).toHaveLength(6);
  });
  it("is empty without merged candidates and says why", () => {
    expect(c.requests(baseContext(), step)).toEqual([]);
    expect(c.skipReason?.(baseContext())).toBe("no confirmed social account to read a second time");
    expect(c.enriches).toBe(true);
  });
});

describe("treg/social-verify parse", () => {
  const parse = (platform: string, ...payload: unknown[]) => {
    const req = reqOf(platform);
    return c.parse(payload.length > 0 ? payload[0] : payloads[req.via === "treg" ? req.endpoint : ""], ctx, step, req);
  };
  it.each([
    ["linkedin", LI, ["4100 followers", "500 connections", "Premium: yes", "Created: 2013-05", "starts in 2011", "Growth lead in Brno."]],
    ["instagram", "https://www.instagram.com/jana/", ["@jana", "1234 followers", "follows 56 accounts", "78 posts", "Verified badge: no", "Bio: Brno"]],
    ["tiktok", "https://www.tiktok.com/@jana", ["9500 followers", "follows 12 accounts", "148 videos", "Created: 2015-02-28"]],
    ["x", "https://x.com/jana", ["321 followers", "follows 45 accounts", "6789 posts", "Verified badge: yes"]],
    ["youtube", "https://www.youtube.com/@jana", ["2500 followers", "33 videos", "Created: Sep 24, 2013"]],
    ["facebook", FB, ["777 followers", "700 likes", "Category: Marketing agency.", "Created: November 25, 2022"]],
  ])("reads %s", (platform, url, needles) => {
    const [s, ...rest] = parse(platform);
    expect(rest).toEqual([]);
    expect(s?.url).toBe(url);
    expect(s?.identity).toBe("merged");
    for (const n of needles) expect(s?.excerpt).toContain(n);
    expect(s?.excerpt).toContain("via treg (second source; the Apify scrape is the first)");
  });
  it("takes the handle from the request, never from the payload", () => {
    const [s] = parse("x", { output: { found: true, data: { handle: "someoneelse", followers: 1 } } });
    expect(s?.url).toBe("https://x.com/jana");
    expect(s?.url).not.toContain("someoneelse");
  });
  it("never lets a sensitive Facebook field into the excerpt or raw", () => {
    const [s] = parse("facebook");
    const all = `${s?.excerpt ?? ""}${JSON.stringify(s?.raw)}`;
    for (const bad of ["FEMALE", "gender", "a@b.cz", "+420111", "Brno", "email", "phone", "address"]) expect(all).not.toContain(bad);
  });
  it("gives nothing for not found, malformed or foreign payloads", () => {
    expect(parse("x", { output: { found: false } })).toEqual([]);
    for (const p of ["linkedin", "instagram", "tiktok", "x", "youtube", "facebook"]) {
      expect(parse(p, "nope")).toEqual([]);
      expect(parse(p, null)).toEqual([]);
      expect(parse(p, {})).toEqual([]);
    }
    expect(c.parse(payloads["tikhub.instagram.user.profile"], ctx, step)).toEqual([]);
    expect(c.parse({}, ctx, step, { via: "fetch", url: "https://x" })).toEqual([]);
  });
});

describe("treg/social-verify digest", () => {
  const fetched = (cx = ctx): Fetched[] => c.requests(cx, step).map((req) => ({ req, payload: payloads[req.via === "treg" ? req.endpoint : ""] }));
  it("records ProfileFacts of merged accounts with a token-free treg source_url", () => {
    const d = c.digest?.(fetched(), ctx) as { platform: string; url: string; followers: number | null; source_url: string; earliest_experience_year: number | null }[];
    expect(d.map((f) => f.platform)).toEqual(["linkedin", "instagram", "tiktok", "x", "youtube", "facebook"]);
    expect(d[1]).toMatchObject({ followers: 1234, url: "https://www.instagram.com/jana/", source_url: "https://treg.to/call/tikhub.instagram.user.profile?username=jana" });
    expect(d[0]).toMatchObject({ earliest_experience_year: 2011, created_at: "2013-05" });
    expect(d[5]?.source_url).toBe(`https://treg.to/call/scrapecreators.x.v1-facebook-profile?url=${encodeURIComponent(FB)}&cache_max_age=7d`);
    for (const f of d) expect(f.source_url).not.toMatch(/token|x-treg/i);
  });
  it("skips accounts that are not merged and returns null when nothing is left", () => {
    const f = fetched();
    const none = baseContext({ candidates: all.map((k) => ({ ...k, decision: "possibly-same-as" as const })) });
    expect(c.digest?.(f, none)).toBeNull();
    expect(c.digest?.([{ req: treg("tikhub.instagram.user.profile", "GET", { username: "jana" }), payload: "bad" }], ctx)).toBeNull();
  });
});
