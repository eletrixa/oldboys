/**
 * Google SERP collector via Apify `apify/google-search-scraper`.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/google-search.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/sources.test.ts
 *
 * Key responsibilities:
 * - Build one query from the step's template; parse organicResults into one Source per hit
 * - A `{role_sites}` query makes no request when the run has no matched role template (no sites to search)
 *
 * Design constraints:
 * - One page per query (10 hits) keeps cost ≈ $0.002 per step
 */
import { z } from "zod";
import type { Collector } from "@/recipe/sources/types";
import { clip, fillQuery } from "@/recipe/sources/types";

const SerpItem = z.object({
  organicResults: z
    .array(z.object({ title: z.string().optional(), url: z.string(), description: z.string().optional() }))
    .default([]),
});

export const googleSearch: Collector = {
  id: "apify/google-search-scraper",
  requests: (ctx, step) =>
    step.query?.includes("{role_sites}") === true && ctx.roleSites.length === 0
      ? []
      : [
    {
      via: "actor",
      actor: "apify/google-search-scraper",
      input: { queries: fillQuery(step.query ?? '"{subject}" {anchor}', ctx), maxPagesPerQuery: 1, resultsPerPage: 10 },
      maxTotalChargeUsd: 0.02,
      timeoutSecs: 90,
    },
        ],
  parse: (payload) => {
    const pages = z.array(SerpItem).safeParse(payload);
    if (!pages.success) return [];
    return pages.data.flatMap((page) =>
      page.organicResults.map((hit) => ({
        url: hit.url,
        excerpt: clip(`${hit.title ?? ""}\n${hit.description ?? ""}`.trim()),
        raw: hit,
        // Discovery: a serp hit names the subject but is not tied to a confirmed profile.
        identity: "unverified" as const,
      })),
    );
  },
};
