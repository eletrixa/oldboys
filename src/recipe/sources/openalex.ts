/**
 * OpenAlex REST collector: author search with output and affiliation counts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/openalex.ts
 * Deps:    zod (REST via ports.fetchJson)
 * Tested:  src/recipe/__tests__/sources-makers.test.ts
 *
 * Key responsibilities:
 * - `rest/openalex`: one Source per matching author; `mailto` requests the polite pool (OpenAlex still answered 429 from Workers egress on 2026-10-08)
 *
 * Design constraints:
 * - Pure: no fetch here; unknown payload shapes parse to []
 * - Free API, no key; five authors per step
 */
import { z } from "zod";
import type { Collector } from "@/recipe/sources/types";
import { clip, identityFor } from "@/recipe/sources/types";

const Authors = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      display_name: z.string(),
      works_count: z.number().optional(),
      cited_by_count: z.number().optional(),
      last_known_institutions: z.array(z.object({ display_name: z.string() })).nullish(),
    }),
  ),
});

export const openalex: Collector = {
  id: "rest/openalex",
  requests: (ctx) =>
    ctx.subject.trim().length === 0
      ? []
      : [{ via: "fetch", url: `https://api.openalex.org/authors?search=${encodeURIComponent(ctx.subject)}&per-page=5&mailto=robert@soulfire.cz` }],
  parse: (payload, ctx) => {
    const r = Authors.safeParse(payload);
    if (!r.success) return [];
    return r.data.results.map((a) => ({
      url: a.id,
      excerpt: clip(
        [
          a.display_name,
          `${String(a.works_count ?? 0)} works`,
          `${String(a.cited_by_count ?? 0)} citations`,
          ...(a.last_known_institutions ?? []).map((i) => i.display_name),
        ].join(" · "),
      ),
      raw: a,
      identity: identityFor(ctx, a.id),
    }));
  },
};
