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
 *
 * Design constraints:
 * - Pure: no fetch; the runner performs I/O. Empty `requests()` triggers the step's onEmpty branch
 * - Excerpts go through clip(); malformed payloads parse to []
 */
import { z } from "zod";
import type { Collector } from "@/recipe/sources/types";
import { clip } from "@/recipe/sources/types";

const Result = z.object({
  actors: z
    .array(z.object({ handle: z.string(), displayName: z.string().nullish(), description: z.string().nullish() }))
    .default([]),
});

export const bluesky: Collector = {
  id: "rest/bluesky",
  requests: (ctx) => [
    {
      via: "fetch",
      url: `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(ctx.subject)}&limit=5`,
    },
  ],
  parse: (payload) => {
    const r = Result.safeParse(payload);
    if (!r.success) return [];
    return r.data.actors.map((a) => ({
      url: `https://bsky.app/profile/${a.handle}`,
      excerpt: clip(`${a.displayName ?? ""} (@${a.handle})\n${a.description ?? ""}`.trim()),
      raw: a,
    }));
  },
};
