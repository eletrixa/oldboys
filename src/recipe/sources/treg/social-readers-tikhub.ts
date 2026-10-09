/**
 * Treg profile readers for the TikHub endpoints: Instagram and TikTok (both wrap the user in a `data` envelope).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/treg/social-readers-tikhub.ts
 * Deps:    zod, src/domain/profile-facts, ./social-account
 * Tested:  src/recipe/__tests__/treg-social-verify.test.ts
 *
 * Key responsibilities:
 * - `TIKHUB_READERS`: the instagram and tiktok readers of the table in social-readers.ts
 *
 * Design constraints:
 * - Pure, no I/O; allow-list parse, every provider field `.nullish()` (catalog examples are truncated)
 */
import { z } from "zod";
import { clipBio, count } from "@/domain/profile-facts";
import { type Reader, bare, flag, nil, num, text } from "@/recipe/sources/treg/social-account";

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

const instagramReader: Reader = {
  platform: "instagram", endpoint: "tikhub.instagram.user.profile", method: "GET", provider: "TikHub", kind: "account", postsLabel: "posts",
  param: () => "username",
  request: (c) => bare(c.handle) || null,
  profileUrl: (id) => `https://www.instagram.com/${id}/`,
  read: (payload, id) => {
    const u = Instagram.safeParse(payload).data?.data?.data?.user;
    if (nil(u)) return null;
    return {
      handle: id, display_name: u.full_name ?? null, bio: clipBio(u.biography), followers: count(u.edge_followed_by?.count),
      following: count(u.edge_follow?.count), posts: count(u.edge_owner_to_timeline_media?.count), verified: u.is_verified ?? null,
      photo_url: u.profile_pic_url ?? null,
    };
  },
};
const tiktokReader: Reader = {
  platform: "tiktok", endpoint: "tikhub.tiktok.user.profile", method: "GET", provider: "TikHub", kind: "account", postsLabel: "videos",
  param: () => "uniqueId",
  request: (c) => bare(c.handle) || null,
  profileUrl: (id) => `https://www.tiktok.com/@${id}`,
  read: (payload, id) => {
    const info = TikTok.safeParse(payload).data?.data?.userInfo;
    const u = info?.user;
    if (nil(u)) return null;
    return {
      handle: id, display_name: u.nickname ?? null, bio: clipBio(u.signature), followers: count(info?.stats?.followerCount),
      following: count(info?.stats?.followingCount), posts: count(info?.stats?.videoCount), verified: u.verified ?? null,
      created_at: isoDay(u.createTime), photo_url: u.avatarLarger ?? null,
    };
  },
};

export const TIKHUB_READERS: readonly Reader[] = [instagramReader, tiktokReader];
