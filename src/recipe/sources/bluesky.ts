/**
 * Bluesky actor-search collector (public AppView, no key).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/bluesky.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-audience.test.ts
 *
 * Key responsibilities:
 * - Search actors by subject name; one Source per actor
 * - `digest`: merged actors' ProfileFacts (followers, following, posts, created_at, bio, avatar)
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

const Result = z.object({
  actors: z
    .array(
      z.object({
        handle: z.string(),
        displayName: z.string().nullish(),
        description: z.string().nullish(),
        followersCount: z.number().nullish(),
        followsCount: z.number().nullish(),
        postsCount: z.number().nullish(),
        createdAt: z.string().nullish(),
        avatar: z.string().nullish(),
      }),
    )
    .default([]),
});

function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export const bluesky: Collector = {
  id: "rest/bluesky",
  requests: (ctx) => [
    {
      via: "fetch",
      url: `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(ctx.subject)}&limit=5`,
    },
  ],
  parse: (payload, ctx) => {
    const r = Result.safeParse(payload);
    if (!r.success) return [];
    // searchActors is fuzzy: drop actors whose name or handle does not carry the subject's surname
    const surname = fold(ctx.subject.trim().split(/\s+/).at(-1) ?? "");
    return r.data.actors.filter((a) => surname.length === 0 || fold(`${a.displayName ?? ""} ${a.handle}`).includes(surname)).map((a) => ({
      url: `https://bsky.app/profile/${a.handle}`,
      identity: identityFor(ctx, `https://bsky.app/profile/${a.handle}`),
      excerpt: clip(`${a.displayName ?? ""} (@${a.handle})\n${a.description ?? ""}`.trim()),
      raw: a,
    }));
  },
  digest: (fetched, ctx) => factsOf(fetched.map((f) => f.payload), ctx),
};

export function factsOf(payloads: readonly unknown[], ctx: StepContext): ProfileFacts[] | null {
  return digestOf(
      payloads.flatMap((pl) => {
        const r = Result.safeParse(pl);
        return r.success ? r.data.actors : [];
      }).flatMap((a) => {
        const url = `https://bsky.app/profile/${a.handle}`;
        if (identityFor(ctx, url) !== "merged") return [];
        const f = emptyFacts("bluesky", url, url);
        f.handle = a.handle;
        f.display_name = a.displayName ?? null;
        f.bio = clipBio(a.description);
        f.created_at = a.createdAt ?? null;
        f.followers = count(a.followersCount);
        f.following = count(a.followsCount);
        f.posts = count(a.postsCount);
        f.photo_url = a.avatar ?? null;
        return [f];
      }),
    );
}
