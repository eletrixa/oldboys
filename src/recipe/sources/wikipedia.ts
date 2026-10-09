/**
 * Wikipedia collector: English and Czech article search by name, then the summary of each full-name hit.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/wikipedia.ts
 * Deps:    zod (REST via ports.fetchJson)
 * Tested:  src/recipe/__tests__/sources-wikipedia.test.ts
 *
 * Key responsibilities:
 * - `rest/wikipedia`: first wave searches en and cs; followUp fetches the REST summary of up to 3 hits per language
 *   whose title or snippet names every part of the subject's name; only summaries become Sources
 *
 * Design constraints:
 * - Pure: no fetch here; unknown payload shapes parse to []
 * - Search payloads are discovery only and never produce a Source
 * - Every request carries the Wikimedia user-agent
 */
import { z } from "zod";
import type { CollectorRequest, Collector, Fetched } from "@/recipe/sources/types";
import { clip } from "@/recipe/sources/types";

const LANGS = ["en", "cs"] as const;
const MAX_PER_LANG = 3;
const HEADERS = { "user-agent": "oldboys-hackathon/0.1 (+https://oldboys.asajj.cz)", accept: "application/json" };

const Search = z.object({
  query: z.object({ search: z.array(z.object({ title: z.string(), snippet: z.string().nullish() })) }),
});
const Summary = z.object({
  title: z.string(),
  extract: z.string().nullish(),
  description: z.string().nullish(),
  content_urls: z.object({ desktop: z.object({ page: z.string() }) }).nullish(),
});

const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const words = (s: string): Set<string> => new Set(fold(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w !== ""));

function langOf(url: string): string {
  return /^https:\/\/([a-z]+)\.wikipedia\.org\//.exec(url)?.[1] ?? "en";
}
const get = (url: string): CollectorRequest => ({ via: "fetch", url, init: { headers: HEADERS } });

export const wikipedia: Collector = {
  id: "rest/wikipedia",
  requests: (ctx) =>
    LANGS.map((l) =>
      get(`https://${l}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(ctx.subject)}&format=json&srlimit=5`),
    ),
  followUp: (ctx, _step, fetched) => {
    const need = [...words(ctx.subject)];
    if (need.length === 0) return [];
    const out: CollectorRequest[] = [];
    for (const { req, payload } of fetched) {
      if (req.via !== "fetch" || !req.url.includes("/w/api.php")) continue;
      const r = Search.safeParse(payload);
      if (!r.success) continue;
      const lang = langOf(req.url);
      let n = 0;
      for (const hit of r.data.query.search) {
        if (n >= MAX_PER_LANG) break;
        const have = words(`${hit.title} ${(hit.snippet ?? "").replace(/<[^>]*>/g, " ")}`);
        if (!need.every((w) => have.has(w))) continue;
        n += 1;
        out.push(get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replaceAll(" ", "_"))}`));
      }
    }
    return out;
  },
  parse: (payload, _ctx, _step, req) => {
    if (req?.via === "fetch" && req.url.includes("/w/api.php")) return [];
    const r = Summary.safeParse(payload);
    if (!r.success) return [];
    const s = r.data;
    const lang = req?.via === "fetch" ? langOf(req.url) : "en";
    const url = s.content_urls?.desktop.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(s.title.replaceAll(" ", "_"))}`;
    const excerpt = clip([s.title, s.description ?? "", s.extract ?? ""].filter((x) => x !== "").join(". "));
    // The article is often already in the run as a search snippet: the summary replaces that snippet (same source row).
    return [{ url, excerpt, raw: s, identity: "unverified", replaces: true }];
  },
  digest: (fetched) => ({
    searched: [...LANGS],
    articles: fetched.filter((f: Fetched) => f.req.via === "fetch" && f.req.url.includes("/page/summary/") && Summary.safeParse(f.payload).success).length,
  }),
};
