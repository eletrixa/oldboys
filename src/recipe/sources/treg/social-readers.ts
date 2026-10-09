/**
 * Treg profile readers table: LinkedIn, Instagram and TikTok here, the rest in social-readers-more.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/treg/social-readers.ts
 * Deps:    zod, src/domain/profile-facts, ./social-account, ./social-readers-more
 * Tested:  src/recipe/__tests__/treg-social-verify.test.ts
 *
 * Key responsibilities:
 * - `READERS`: one reader per platform (linkedin, instagram, tiktok, x, youtube, facebook); `request` returns null when the candidate has no handle or url
 * - `read` is an allow-list: only the named fields reach the Account; the handle comes from the request params, never from the payload;
 *   a malformed or "not found" payload reads as null
 *
 * Design constraints:
 * - Pure, no I/O; every provider field is `.nullish()` because the catalog examples are truncated
 */
import { z } from "zod";
import { clipBio, count, experienceYear } from "@/domain/profile-facts";
import { type Reader, acct, flag, handleReq, nil, num, str, text, urlReq } from "@/recipe/sources/treg/social-account";
import { MORE_READERS } from "@/recipe/sources/treg/social-readers-more";

const LinkedIn = z.object({
  id: text, publicIdentifier: text, firstName: text, lastName: text, title: text, description: text, profilePictureUrl: text,
  premium: flag, isVerified: flag, openToWork: flag, followerCount: num, connectionsCount: num,
  joinDate: z.object({ month: num, year: num }).nullish(),
  experiences: z.array(z.object({ dateRange: text })).nullish(),
});
const Instagram = z.object({
  data: z.object({ data: z.object({ user: z.object({
    username: text, full_name: text, biography: text, is_verified: flag, profile_pic_url: text,
    edge_followed_by: z.object({ count: num }).nullish(), edge_follow: z.object({ count: num }).nullish(),
    edge_owner_to_timeline_media: z.object({ count: num }).nullish(),
  }).nullish() }).nullish() }).nullish(),
});
const TikTok = z.object({
  data: z.object({ userInfo: z.object({
    user: z.object({ uniqueId: text, nickname: text, signature: text, verified: flag, createTime: num, avatarLarger: text }).nullish(),
    stats: z.object({ followerCount: num, followingCount: num, videoCount: num }).nullish(),
  }).nullish() }).nullish(),
});

const isoDay = (unixSeconds: number | null | undefined): string | null => {
  const d = new Date((unixSeconds ?? Number.NaN) * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

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
const instagramReader: Reader = {
  platform: "instagram", endpoint: "tikhub.instagram.user.profile", method: "GET", provider: "TikHub", kind: "account", postsLabel: "posts",
  request: (c) => handleReq(c, "username"),
  profileUrl: (p) => `https://www.instagram.com/${str(p.username)}/`,
  read: (payload, p) => {
    const u = Instagram.safeParse(payload).data?.data?.data?.user;
    if (nil(u)) return null;
    return acct({
      handle: str(p.username), name: u.full_name ?? null, bio: clipBio(u.biography), followers: count(u.edge_followed_by?.count),
      following: count(u.edge_follow?.count), posts: count(u.edge_owner_to_timeline_media?.count), verified: u.is_verified ?? null,
      photo_url: u.profile_pic_url ?? null,
    });
  },
};
const tiktokReader: Reader = {
  platform: "tiktok", endpoint: "tikhub.tiktok.user.profile", method: "GET", provider: "TikHub", kind: "account", postsLabel: "videos",
  request: (c) => handleReq(c, "uniqueId"),
  profileUrl: (p) => `https://www.tiktok.com/@${str(p.uniqueId)}`,
  read: (payload, p) => {
    const info = TikTok.safeParse(payload).data?.data?.userInfo;
    const u = info?.user;
    if (nil(u)) return null;
    return acct({
      handle: str(p.uniqueId), name: u.nickname ?? null, bio: clipBio(u.signature), followers: count(info?.stats?.followerCount),
      following: count(info?.stats?.followingCount), posts: count(info?.stats?.videoCount), verified: u.verified ?? null,
      created_at: isoDay(u.createTime), photo_url: u.avatarLarger ?? null,
    });
  },
};

export const READERS: readonly Reader[] = [linkedinReader, instagramReader, tiktokReader, ...MORE_READERS];
