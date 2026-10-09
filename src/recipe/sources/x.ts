/**
 * X (Twitter) collector via Apify `apidojo/tweet-scraper`.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/x.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-audience.test.ts
 *
 * Key responsibilities:
 * - Request latest tweets for a candidate with platform x and a handle; one Source per tweet plus one author profile Source
 * - `digest`: merged authors' ProfileFacts (followers, following, created_at, bio, verified, photo), one per handle
 *
 * Design constraints:
 * - Pure: no fetch; the runner performs I/O. Empty `requests()` triggers the step's onEmpty branch
 * - Excerpts go through clip(); malformed payloads parse to []
 */
import { z } from "zod";
import { clipBio, count, facts } from "@/domain/profile-facts";
import { dedupeBy, digestOf, parsedAll } from "@/recipe/sources/facts";
import type { Collector } from "@/recipe/sources/types";
import { clip, identityFor } from "@/recipe/sources/types";

const Author = z.object({
  userName: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  followers: z.number().nullish(),
  createdAt: z.string().nullish(),
  following: z.number().nullish(),
  profilePicture: z.string().nullish(),
  isVerified: z.boolean().nullish(),
  isBlueVerified: z.boolean().nullish(),
});
const Tweet = z.object({
  url: z.string(),
  text: z.string().nullish(),
  createdAt: z.string().nullish(),
  likeCount: z.number().nullish(),
  author: Author.nullish(),
});

export const x: Collector = {
  id: "apidojo/tweet-scraper",
  requests: (ctx) => {
    const c = ctx.candidates.find((k) => k.platform === "x" && k.handle !== null && k.decision !== "rejected");
    const handle = (c?.handle ?? "").replace(/^@/, "");
    if (handle === "") return [];
    return [
      {
        via: "actor",
        actor: "apidojo/tweet-scraper",
        input: { twitterHandles: [handle], maxItems: 20, sort: "Latest" },
        maxTotalChargeUsd: 0.03,
        timeoutSecs: 45,
      },
    ];
  },
  parse: (payload, ctx) => {
    const items = z.array(Tweet).safeParse(payload);
    if (!items.success) return [];
    const tweets = items.data.map((t) => ({
      url: t.url,
      excerpt: clip(`${t.text ?? ""}\n${t.createdAt ?? ""} · ${String(t.likeCount ?? 0)} likes`.trim()),
      raw: t,
      identity: identityFor(ctx, t.url),
    }));
    const a = items.data[0]?.author;
    if (a?.userName === undefined || a.userName === null) return tweets;
    const profile = {
      url: `https://x.com/${a.userName}`,
      excerpt: clip(
        `${a.name ?? ""} (@${a.userName})\n${a.description ?? ""}\nFollowers: ${String(a.followers ?? "?")}, joined: ${a.createdAt ?? "?"}`,
      ),
      raw: a,
      identity: identityFor(ctx, `https://x.com/${a.userName}`),
    };
    return [profile, ...tweets];
  },
  digest: (fetched, ctx) =>
    digestOf(
      dedupeBy(
        parsedAll(z.array(Tweet), fetched).flatMap((items) => items.flatMap((t) => (t.author ? [t.author] : []))),
        (a) => (a.userName ?? "").toLowerCase(),
      )
        .filter((a) => identityFor(ctx, `https://x.com/${a.userName ?? ""}`) === "merged")
        .map((a) =>
          facts("x", `https://x.com/${a.userName ?? ""}`, {
            handle: a.userName ?? null,
            display_name: a.name ?? null,
            bio: clipBio(a.description),
            created_at: a.createdAt ?? null,
            followers: count(a.followers),
            following: count(a.following),
            verified: a.isBlueVerified ?? a.isVerified ?? null,
            photo_url: a.profilePicture ?? null,
          }),
        ),
    ),
};
