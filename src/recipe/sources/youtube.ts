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
 *
 * Design constraints:
 * - Pure: no fetch; the runner performs I/O. Empty `requests()` triggers the step's onEmpty branch
 * - Excerpts go through clip(); malformed payloads parse to []
 */
import { z } from "zod";
import type { Collector } from "@/recipe/sources/types";
import { clip, platformOf } from "@/recipe/sources/types";

const Video = z.object({
  url: z.string(),
  title: z.string().nullish(),
  channelName: z.string().nullish(),
  viewCount: z.number().nullish(),
  date: z.string().nullish(),
  text: z.string().nullish(),
});

export const youtube: Collector = {
  id: "streamers/youtube-scraper",
  requests: (ctx) => {
    const url = ctx.candidates
      .filter((c) => c.platform === "youtube" && c.decision !== "rejected")
      .flatMap((c) => c.profile_urls)
      .find((u) => platformOf(u) === "youtube");
    const input: Record<string, unknown> =
      url === undefined
        ? { searchQueries: [ctx.subject], maxResults: 5 }
        : { startUrls: [{ url }], maxResults: 5 };
    return [{ via: "actor", actor: "streamers/youtube-scraper", input, maxTotalChargeUsd: 0.03, timeoutSecs: 45 }];
  },
  parse: (payload) => {
    const items = z.array(Video).safeParse(payload);
    if (!items.success) return [];
    return items.data.map((v) => ({
      url: v.url,
      excerpt: clip(
        `${v.title ?? ""}\nChannel: ${v.channelName ?? "?"} · views: ${String(v.viewCount ?? "?")} · ${v.date ?? ""}\n${clip(v.text ?? "", 500)}`.trim(),
      ),
      raw: v,
    }));
  },
};
