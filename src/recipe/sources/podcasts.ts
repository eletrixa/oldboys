/**
 * Podcast collector: Apple podcast episode search, kept when the episode names the subject's surname.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/podcasts.ts
 * Deps:    zod (REST via ports.fetchJson)
 * Tested:  src/recipe/__tests__/sources-podcasts.test.ts
 *
 * Key responsibilities:
 * - `rest/podcasts`: one Source per episode whose title or description has the surname as a whole word, newest first, max 15
 *
 * Design constraints:
 * - Pure: no fetch here; unknown payload shapes parse to []
 * - Surname is the last name part; a single-word subject yields no request
 */
import { z } from "zod";
import type { Collector } from "@/recipe/sources/types";
import { clip } from "@/recipe/sources/types";

const MAX_EPISODES = 15;
const Episodes = z.object({
  results: z.array(
    z.object({
      trackName: z.string(),
      collectionName: z.string().nullish(),
      releaseDate: z.string().nullish(),
      trackViewUrl: z.string(),
      description: z.string().nullish(),
      shortDescription: z.string().nullish(),
    }),
  ),
});

const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const surnameOf = (subject: string): string => fold(subject.trim().split(/\s+/).at(-1) ?? "");
const hasWord = (text: string, word: string): boolean => word !== "" && fold(text).split(/[^\p{L}\p{N}]+/u).includes(word);

export const podcasts: Collector = {
  id: "rest/podcasts",
  requests: (ctx) =>
    ctx.subject.trim().split(/\s+/).length < 2
      ? []
      : [
          {
            via: "fetch",
            url: `https://itunes.apple.com/search?term=${encodeURIComponent(ctx.subject)}&media=podcast&entity=podcastEpisode&limit=25`,
            init: { headers: { "user-agent": "oldboys-hackathon/0.1 (+https://oldboys.asajj.cz)", accept: "application/json" } },
          },
        ],
  parse: (payload, ctx) => {
    const r = Episodes.safeParse(payload);
    if (!r.success) return [];
    const sur = surnameOf(ctx.subject);
    return r.data.results
      .filter((e) => hasWord(e.trackName, sur) || hasWord(e.description ?? e.shortDescription ?? "", sur))
      .sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""))
      .slice(0, MAX_EPISODES)
      .map((e) => {
        const date = e.releaseDate?.slice(0, 10);
        const head = `Podcast episode '${e.trackName}' on ${e.collectionName ?? "an unnamed podcast"}${date === undefined ? "" : `, released ${date}`}.`;
        const desc = (e.description ?? e.shortDescription ?? "").trim().slice(0, 700);
        return { url: e.trackViewUrl, excerpt: clip(desc === "" ? head : `${head} ${desc}`), raw: e, identity: "unverified" as const };
      });
  },
  digest: (fetched, ctx) => ({ episodes: fetched.reduce((n, f) => n + podcasts.parse(f.payload, ctx, {} as never, f.req).length, 0) }),
};
