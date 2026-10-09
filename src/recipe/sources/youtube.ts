/**
 * YouTube collector via Apify `streamers/youtube-scraper`.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/youtube.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-audience.test.ts
 *
 * Key responsibilities:
 * - Scrape a known channel url, else search the subject; one Source per video
 * - `digest`: the merged channel's ProfileFacts (name, subscribers when the actor reports them); nothing without a merged channel
 *
 * Design constraints:
 * - Pure: no fetch; the runner performs I/O. Empty `requests()` triggers the step's onEmpty branch
 * - Excerpts go through clip(); malformed payloads parse to []
 */
import { z } from "zod";
import { count, facts } from "@/domain/profile-facts";
import { parsedAll } from "@/recipe/sources/facts";
import type { Collector } from "@/recipe/sources/types";
import type { Candidate } from "@/domain/claim";
import type { StepContext } from "@/recipe/sources/types";
import { clip, identityFor, platformOf } from "@/recipe/sources/types";

const Video = z.object({
  url: z.string(),
  title: z.string().nullish(),
  channelName: z.string().nullish(),
  numberOfSubscribers: z.number().nullish(),
  viewCount: z.number().nullish(),
  date: z.string().nullish(),
  text: z.string().nullish(),
});

/** The channel requests() scrapes; undefined means a name search. */
function channel(ctx: StepContext): { url: string; candidate: Candidate } | undefined {
  for (const c of ctx.candidates) {
    if (c.platform !== "youtube" || c.decision === "rejected") continue;
    const url = c.profile_urls.find((u) => platformOf(u) === "youtube");
    if (url !== undefined) return { url, candidate: c };
  }
  return undefined;
}

export const youtube: Collector = {
  id: "streamers/youtube-scraper",
  requests: (ctx) => {
    const url = channel(ctx)?.url;
    const input: Record<string, unknown> =
      url === undefined
        ? { searchQueries: [ctx.subject], maxResults: 5 }
        : { startUrls: [{ url }], maxResults: 5 };
    return [{ via: "actor", actor: "streamers/youtube-scraper", input, maxTotalChargeUsd: 0.03, timeoutSecs: 45 }];
  },
  parse: (payload, ctx) => {
    const items = z.array(Video).safeParse(payload);
    if (!items.success) return [];
    // Video urls (watch?v=) carry no handle: a merged channel vouches for its own videos.
    const merged = channel(ctx)?.candidate.decision === "merge";
    return items.data.map((v) => ({
      url: v.url,
      excerpt: clip(
        `${v.title ?? ""}\nChannel: ${v.channelName ?? "?"} · views: ${String(v.viewCount ?? "?")} · ${v.date ?? ""}\n${clip(v.text ?? "", 500)}`.trim(),
      ),
      raw: v,
      identity: merged ? ("merged" as const) : identityFor(ctx, v.url),
    }));
  },
  digest: (fetched, ctx) => {
    const ch = channel(ctx);
    if (ch === undefined || identityFor(ctx, ch.url) !== "merged") return null;
    const video = parsedAll(z.array(Video), fetched).flat()[0];
    return [
      facts("youtube", ch.url, {
        handle: /\/@([^/?#]+)/.exec(ch.url)?.[1] ?? null,
        display_name: video?.channelName ?? null,
        followers: count(video?.numberOfSubscribers),
      }),
    ];
  },
};
