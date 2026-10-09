/**
 * Instagram profile collector via Apify `apify/instagram-profile-scraper`.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/instagram.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-audience.test.ts
 *
 * Key responsibilities:
 * - Request profiles only for candidates with platform instagram and a handle (merge or possibly-same-as); one Source per profile
 * - `digest`: merged profiles' ProfileFacts (followers, following, posts, verified, bio, photo)
 *
 * Design constraints:
 * - Pure: no fetch; the runner performs I/O. Empty `requests()` triggers the step's onEmpty branch
 * - Excerpts go through clip(); malformed payloads parse to []
 */
import { z } from "zod";
import type { Candidate } from "@/domain/claim";
import { clipBio, count, facts } from "@/domain/profile-facts";
import { digestOf, parsedAll } from "@/recipe/sources/facts";
import type { Collector } from "@/recipe/sources/types";
import { clip, identityFor } from "@/recipe/sources/types";

const Profile = z.object({
  username: z.string(),
  fullName: z.string().nullish(),
  biography: z.string().nullish(),
  followersCount: z.number().nullish(),
  followsCount: z.number().nullish(),
  postsCount: z.number().nullish(),
  verified: z.boolean().nullish(),
  externalUrl: z.string().nullish(),
  profilePicUrl: z.string().nullish(),
  latestPosts: z.array(z.object({ caption: z.string().nullish() })).nullish(),
});

const usable = (c: Candidate): boolean => c.decision === "merge" || c.decision === "possibly-same-as";

export const instagram: Collector = {
  id: "apify/instagram-profile-scraper",
  requests: (ctx) => {
    const usernames = ctx.candidates
      .filter((c) => c.platform === "instagram" && c.handle !== null && usable(c))
      .map((c) => (c.handle ?? "").replace(/^@/, ""))
      .filter((h) => h !== "");
    if (usernames.length === 0) return [];
    return [
      {
        via: "actor",
        actor: "apify/instagram-profile-scraper",
        input: { usernames: [...new Set(usernames)] },
        maxTotalChargeUsd: 0.02,
        timeoutSecs: 45,
      },
    ];
  },
  parse: (payload, ctx) => {
    const items = z.array(Profile).safeParse(payload);
    if (!items.success) return [];
    return items.data.map((p) => {
      const captions = (p.latestPosts ?? [])
        .slice(0, 3)
        .map((post) => clip(post.caption ?? "", 200))
        .filter((c) => c !== "");
      const lines = [
        `Name: ${p.fullName ?? ""}`,
        `Bio: ${p.biography ?? ""}`,
        `Followers: ${String(p.followersCount ?? "?")}, following: ${String(p.followsCount ?? "?")}, posts: ${String(p.postsCount ?? "?")}`,
        `Verified: ${p.verified === true ? "yes" : "no"}`,
        `Link: ${p.externalUrl ?? ""}`,
        ...captions.map((c, i) => `Post ${String(i + 1)}: ${c}`),
      ];
      const url = `https://www.instagram.com/${p.username}/`;
      return { url, excerpt: clip(lines.join("\n")), raw: p, identity: identityFor(ctx, url) };
    });
  },
  digest: (fetched, ctx) =>
    digestOf(
      parsedAll(z.array(Profile), fetched)
        .flat()
        .filter((p) => identityFor(ctx, `https://www.instagram.com/${p.username}/`) === "merged")
        .map((p) =>
          facts("instagram", `https://www.instagram.com/${p.username}/`, {
            handle: p.username,
            display_name: p.fullName ?? null,
            bio: clipBio(p.biography),
            followers: count(p.followersCount),
            following: count(p.followsCount),
            posts: count(p.postsCount),
            verified: p.verified ?? null,
            photo_url: p.profilePicUrl ?? null,
          }),
        ),
    ),
};
