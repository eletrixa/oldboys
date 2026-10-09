/**
 * Treg profile readers table: LinkedIn, X, YouTube and Facebook here; Instagram and TikTok (TikHub) in social-readers-tikhub.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/treg/social-readers.ts
 * Deps:    zod, src/domain/profile-facts, ./social-account, ./social-readers-tikhub
 * Tested:  src/recipe/__tests__/treg-social-verify.test.ts
 *
 * Key responsibilities:
 * - `READERS`: one reader per platform (linkedin, instagram, tiktok, x, youtube, facebook); `request` returns null when the candidate has no handle or url
 * - the Facebook reader drops gender, email, phone and address
 * - `read` is an allow-list: only the named fields reach the Account; the handle comes from the request params, never from the payload;
 *   a malformed or "not found" payload reads as null
 *
 * Design constraints:
 * - Pure, no I/O; every provider field is `.nullish()` because the catalog examples are truncated
 */
import { z } from "zod";
import { clipBio, count, experienceYear } from "@/domain/profile-facts";
import { type Reader, acct, bare, flag, handleReq, nil, num, str, text, urlReq } from "@/recipe/sources/treg/social-account";
import { TIKHUB_READERS } from "@/recipe/sources/treg/social-readers-tikhub";

const LinkedIn = z.object({
  id: text, publicIdentifier: text, firstName: text, lastName: text, title: text, description: text, profilePictureUrl: text,
  premium: flag, isVerified: flag, openToWork: flag, followerCount: num, connectionsCount: num,
  joinDate: z.object({ month: num, year: num }).nullish(),
  experiences: z.array(z.object({ dateRange: text })).nullish(),
});
const XUser = z.object({
  output: z.object({
    found: flag,
    data: z.object({ displayName: text, bio: text, followers: num, following: num, tweets: num, verified: flag, avatarUrl: text }).nullish(),
  }).nullish(),
});
const YouTube = z.object({
  success: flag, channelId: text, name: text, description: text, subscriberCount: num, videoCount: num, joinedDateText: text, isVerified: flag,
  avatar: z.object({ image: z.object({ sources: z.array(z.object({ url: text })).nullish() }).nullish() }).nullish(),
});
const Facebook = z.object({ success: flag, id: text, name: text, creationDate: text, followerCount: num, likeCount: num, category: text, website: text });

const linkedinReader: Reader = {
  platform: "linkedin", endpoint: "fetchinio.linkedin.user.profile", method: "GET", provider: "Fetchin", kind: "profile", postsLabel: "posts",
  request: (c) => urlReq(c, "profileUrlOrUrn"),
  profileUrl: (p) => str(p.profileUrlOrUrn),
  read: (payload) => {
    const r = LinkedIn.safeParse(payload);
    if (!r.success) return null;
    const d = r.data;
    if (nil(d.id) && nil(d.publicIdentifier) && nil(d.firstName) && nil(d.title)) return null;
    const month = nil(d.joinDate?.month) ? "" : `-${String(d.joinDate.month).padStart(2, "0")}`;
    return acct({
      name: `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || null, bio: clipBio(d.description) ?? clipBio(d.title),
      followers: count(d.followerCount), connections: count(d.connectionsCount), verified: d.isVerified ?? null, premium: d.premium ?? null,
      open_to_work: d.openToWork ?? null, created_at: nil(d.joinDate?.year) ? null : `${String(d.joinDate.year)}${month}`,
      photo_url: d.profilePictureUrl ?? null, first_year: experienceYear((d.experiences ?? []).map((e) => e.dateRange)),
    });
  },
};
const xReader: Reader = {
  platform: "x", endpoint: "anyapi.x.user.profile", method: "POST", provider: "AnyAPI", kind: "account", postsLabel: "posts",
  request: (c) => handleReq(c, "handle"),
  profileUrl: (p) => `https://x.com/${str(p.handle)}`,
  read: (payload, p) => {
    const o = XUser.safeParse(payload).data?.output;
    const u = o?.data;
    if (nil(o) || o.found === false || nil(u)) return null;
    return acct({
      handle: str(p.handle), name: u.displayName ?? null, bio: clipBio(u.bio), followers: count(u.followers), following: count(u.following),
      posts: count(u.tweets), verified: u.verified ?? null, photo_url: u.avatarUrl ?? null,
    });
  },
};
const youtubeReader: Reader = {
  platform: "youtube", endpoint: "scrapecreators.youtube.channel.profile", method: "GET", provider: "ScrapeCreators", kind: "account", postsLabel: "videos",
  request: (c) => (/^UC[\w-]{20,}$/.test(bare(c.handle)) ? { channelId: bare(c.handle) } : handleReq(c, "handle")),
  profileUrl: (p) => (p.channelId === undefined ? `https://www.youtube.com/@${str(p.handle)}` : `https://www.youtube.com/channel/${str(p.channelId)}`),
  read: (payload, p) => {
    const d = YouTube.safeParse(payload).data;
    if (nil(d) || d.success === false || (nil(d.channelId) && nil(d.name))) return null;
    return acct({
      handle: str(p.handle) || null, name: d.name ?? null, bio: clipBio(d.description), followers: count(d.subscriberCount), posts: count(d.videoCount),
      verified: d.isVerified ?? null, created_at: d.joinedDateText?.replace(/^Joined\s+/i, "") ?? null, photo_url: d.avatar?.image?.sources?.[0]?.url ?? null,
    });
  },
};
const facebookReader: Reader = {
  platform: "facebook", endpoint: "scrapecreators.x.v1-facebook-profile", method: "GET", provider: "ScrapeCreators", kind: "page", postsLabel: "posts",
  request: (c) => urlReq(c, "url", { cache_max_age: "7d" }),
  profileUrl: (p) => str(p.url),
  read: (payload) => {
    const d = Facebook.safeParse(payload).data;
    if (nil(d) || d.success === false || (nil(d.id) && nil(d.name))) return null;
    const likes = count(d.likeCount);
    return acct({
      name: d.name ?? null, followers: count(d.followerCount), created_at: d.creationDate ?? null,
      extras: [
        ...(nil(d.category) ? [] : [`Category: ${d.category}.`]),
        ...(likes === null ? [] : [`The page has ${String(likes)} likes.`]),
        ...(nil(d.website) ? [] : [`Website: ${d.website}.`]),
      ],
    });
  },
};

export const READERS: readonly Reader[] = [linkedinReader, ...TIKHUB_READERS, xReader, youtubeReader, facebookReader];
