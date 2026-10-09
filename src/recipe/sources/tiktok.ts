/**
 * TikTok collector via Apify `clockworks/tiktok-profile-scraper`.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/tiktok.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-audience.test.ts
 *
 * Key responsibilities:
 * - Request recent videos for a candidate with platform tiktok and a handle; one Source per video item
 * - `digest`: merged authors' ProfileFacts (followers = fans, following, bio, verified, avatar), one per author
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

const Item = z.object({
  webVideoUrl: z.string().nullish(),
  text: z.string().nullish(),
  authorMeta: z
    .object({
      name: z.string().nullish(),
      signature: z.string().nullish(),
      fans: z.number().nullish(),
      profileUrl: z.string().nullish(),
      following: z.number().nullish(),
      avatar: z.string().nullish(),
      verified: z.boolean().nullish(),
    })
    .nullish(),
});

export const tiktok: Collector = {
  id: "clockworks/tiktok-profile-scraper",
  requests: (ctx) => {
    const c = ctx.candidates.find((k) => k.platform === "tiktok" && k.handle !== null && k.decision !== "rejected");
    const handle = (c?.handle ?? "").replace(/^@/, "");
    if (handle === "") return [];
    return [
      {
        via: "actor",
        actor: "clockworks/tiktok-profile-scraper",
        input: { profiles: [handle], resultsPerPage: 5 },
        maxTotalChargeUsd: 0.02,
        timeoutSecs: 45,
      },
    ];
  },
  parse: (payload, ctx) => {
    const items = z.array(Item).safeParse(payload);
    if (!items.success) return [];
    return items.data.flatMap((i) => {
      const name = i.authorMeta?.name ?? undefined;
      const url = i.webVideoUrl ?? i.authorMeta?.profileUrl ?? (name === undefined ? undefined : `https://www.tiktok.com/@${name}`);
      if (url === undefined) return [];
      const excerpt = clip(
        `${name ?? ""} · fans: ${String(i.authorMeta?.fans ?? "?")}\n${i.authorMeta?.signature ?? ""}\n${i.text ?? ""}`.trim(),
      );
      return [{ url, excerpt, raw: i, identity: identityFor(ctx, url) }];
    });
  },
  digest: (fetched, ctx) =>
    digestOf(
      dedupeBy(
        parsedAll(z.array(Item), fetched).flatMap((items) => items.flatMap((i) => (i.authorMeta ? [i.authorMeta] : []))),
        (a) => (a.name ?? "").toLowerCase(),
      )
        .map((a) => ({ a, url: a.profileUrl ?? `https://www.tiktok.com/@${a.name ?? ""}` }))
        .filter(({ url }) => identityFor(ctx, url) === "merged")
        .map(({ a, url }) =>
          facts("tiktok", url, {
            handle: a.name ?? null,
            bio: clipBio(a.signature),
            followers: count(a.fans),
            following: count(a.following),
            verified: a.verified ?? null,
            photo_url: a.avatar ?? null,
          }),
        ),
    ),
};
