/**
 * Website crawler collector via apify/website-content-crawler.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/website.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-web.test.ts
 *
 * Key responsibilities:
 * - Pick up to 3 non-social start URLs (web candidates, links in source excerpts); one Source per crawled page
 *
 * Design constraints:
 * - Pure: no network; the runner performs the actor call. Parsing is lenient (unknown fields ignored)
 * - Input fields verified against https://apify.com/apify/website-content-crawler.md
 */
import { z } from "zod";
import type { Collector, StepContext } from "@/recipe/sources/types";
import { acceptedCandidates, clip, identityFor, platformOf } from "@/recipe/sources/types";

const LINK = /https?:\/\/[^\s<>"')\]]+/g;

function startUrls(ctx: StepContext): string[] {
  const fromCandidates = acceptedCandidates(ctx)
    .filter((c) => c.platform === "web")
    .flatMap((c) => c.profile_urls);
  const fromExcerpts = ctx.sources
    .flatMap((s) => s.excerpt.match(LINK) ?? [])
    .map((u) => u.replace(/[.,;:]+$/, ""))
    .filter((u) => platformOf(u) === "web");
  return [...new Set([...fromCandidates, ...fromExcerpts])].slice(0, 3);
}

const Page = z.object({ url: z.string(), text: z.string().default(""), metadata: z.object({ title: z.string().optional() }).default({}) });

export const websiteCrawler: Collector = {
  id: "apify/website-content-crawler",
  requests: (ctx) => {
    const urls = startUrls(ctx);
    if (urls.length === 0) return [];
    return [
      {
        via: "actor",
        actor: "apify/website-content-crawler",
        input: { startUrls: urls.map((url) => ({ url })), maxCrawlPages: 5, maxCrawlDepth: 1, saveMarkdown: false, crawlerType: "cheerio" },
        maxTotalChargeUsd: 0.05,
        timeoutSecs: 45,
      },
    ];
  },
  parse: (payload, ctx) => {
    const pages = z.array(Page).safeParse(payload);
    if (!pages.success) return [];
    return pages.data.map((p) => ({ url: p.url, excerpt: clip(`${p.metadata.title ?? ""}\n${p.text.slice(0, 1800)}`.trim()), raw: p, identity: identityFor(ctx, p.url) }));
  },
};
