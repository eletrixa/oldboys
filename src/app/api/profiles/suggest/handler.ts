/**
 * suggestProfiles: one Brave Web Search call for public LinkedIn profiles matching a name (plans/011).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/profiles/suggest/handler.ts
 * Deps:    zod, src/domain/{profile-suggest,ports}
 * Tested:  src/app/api/profiles/__tests__/suggest.test.ts
 *
 * Key responsibilities:
 * - 400 for a query outside 3..100 chars, 503 without a key, 502 when the provider fails or answers an unexpected shape
 * - 200 {suggestions, source: "web-search"}; an empty result set is a 200 with []
 * - No `country` parameter: Brave answers 422 for CZ (not in its enum), and the `site:` filter plus the name already narrow it
 *
 * Design constraints:
 * - The picker never reads linkedin.com; only search-engine snippets of public pages (brief hard rule)
 * - No Next.js imports; fetch and key are parameters so the test fakes the provider by URL
 */
import { z } from "zod";
import type { JsonFetch } from "@/domain/ports";
import { SUGGEST_QUERY_MAX, SUGGEST_QUERY_MIN, suggestionsFromHits, suggestQuery } from "@/domain/profile-suggest";

export const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
export const SUGGEST_SOURCE = "web-search";

export type SuggestDeps = { fetchJson: JsonFetch; key: string };

const BraveResponse = z.object({
  web: z.object({ results: z.array(z.object({ title: z.string().default(""), url: z.string(), description: z.string().optional() })).default([]) }).optional(),
});

export async function suggestProfiles(rawQ: string, rawHint: string, deps: SuggestDeps): Promise<Response> {
  const q = rawQ.replace(/\s+/g, " ").trim();
  const hint = rawHint.replace(/\s+/g, " ").trim().slice(0, SUGGEST_QUERY_MAX);
  if (q.length < SUGGEST_QUERY_MIN || q.length > SUGGEST_QUERY_MAX) {
    return Response.json({ error: "query must be 3 to 100 characters" }, { status: 400 });
  }
  if (deps.key === "") return Response.json({ error: "suggest unavailable" }, { status: 503 });

  const url = new URL(BRAVE_SEARCH_URL);
  url.searchParams.set("q", suggestQuery(q, hint));
  url.searchParams.set("count", "20");
  let raw: unknown;
  try {
    raw = await deps.fetchJson(url.toString(), { headers: { "X-Subscription-Token": deps.key } });
  } catch (e) {
    console.warn("profile suggest failed", e instanceof Error ? e.message : String(e));
    return Response.json({ error: "search unavailable" }, { status: 502 });
  }
  const parsed = BraveResponse.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "search unavailable" }, { status: 502 });
  return Response.json({ suggestions: suggestionsFromHits(parsed.data.web?.results ?? []), source: SUGGEST_SOURCE });
}
