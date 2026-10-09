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
import { clipBio, emptyFacts, type ProfileFacts } from "@/domain/profile-facts";
import { count, digestOf } from "@/recipe/sources/facts";
import type { Collector, StepContext } from "@/recipe/sources/types";
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
  digest: (fetched, ctx) => factsOf(fetched.map((f) => f.payload), ctx),
};

export function factsOf(payloads: readonly unknown[], ctx: StepContext): ProfileFacts[] | null {
  const facts = new Map<string, ProfileFacts>();
  for (const pl of payloads) {
    const items = z.array(Tweet).safeParse(pl);
    if (!items.success) continue;
    for (const a of items.data.flatMap((t) => (t.author ? [t.author] : []))) {
      const handle = a.userName ?? "";
      const url = `https://x.com/${handle}`;
      if (handle === "" || facts.has(handle.toLowerCase()) || identityFor(ctx, url) !== "merged") continue;
      const f = emptyFacts("x", url, url);
      f.handle = handle;
      f.display_name = a.name ?? null;
      f.bio = clipBio(a.description);
      f.created_at = a.createdAt ?? null;
      f.followers = count(a.followers);
      f.following = count(a.following);
      f.verified = a.isBlueVerified ?? a.isVerified ?? null;
      f.photo_url = a.profilePicture ?? null;
      facts.set(handle.toLowerCase(), f);
    }
  }
  return digestOf([...facts.values()]);
}
