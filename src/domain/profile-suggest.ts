/**
 * Profile suggestions (plans/011): a web-search query for public LinkedIn profiles and the parse of its hits.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/profile-suggest.ts
 * Deps:    src/domain/profile-url
 * Tested:  src/domain/__tests__/profile-suggest.test.ts
 *
 * Key responsibilities:
 * - `suggestQuery`: `site:linkedin.com/in "<name>" <hint>` (quotes stripped from the name, hint optional)
 * - `parseProfileTitle`: "Name - Headline - Company | LinkedIn" -> {name, headline}; tolerant of en dashes and a missing suffix
 * - `suggestionsFromHits`: keep only /in/ URLs `normalizeLinkedinProfile` accepts, dedupe by normalised URL, keep order, cap at MAX
 *
 * Design constraints:
 * - Pure; a hit with an unparseable title is kept with the handle as the name, never dropped
 * - Suggestions are candidates to pick, never identity: no scoring, no reordering
 */
import { nameFromHandle, normalizeLinkedinProfile } from "@/domain/profile-url";

export const SUGGEST_MAX = 8;
export const SUGGEST_QUERY_MIN = 3;
export const SUGGEST_QUERY_MAX = 100;

export type SearchHit = { title: string; url: string; description?: string };
export type Suggestion = { url: string; name: string; headline: string; snippet: string };

export function suggestQuery(name: string, hint = ""): string {
  const clean = name.replace(/["]/g, " ").replace(/\s+/g, " ").trim();
  const extra = hint.replace(/["]/g, " ").replace(/\s+/g, " ").trim();
  return `site:linkedin.com/in "${clean}"${extra === "" ? "" : ` ${extra}`}`;
}

const SUFFIX = /\s*[|\-–]\s*LinkedIn\s*$/i;
const SEP = /\s+[-–|]\s+/;

export function parseProfileTitle(title: string): { name: string; headline: string } {
  const parts = title.replace(SUFFIX, "").trim().split(SEP).map((p) => p.trim()).filter((p) => p !== "");
  const [name = "", ...rest] = parts;
  return { name, headline: rest.join(" · ") };
}

export function suggestionsFromHits(hits: readonly SearchHit[], max = SUGGEST_MAX): Suggestion[] {
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const url = normalizeLinkedinProfile(hit.url);
    if (url === null || seen.has(url)) continue;
    seen.add(url);
    const parsed = parseProfileTitle(hit.title);
    out.push({
      url,
      name: parsed.name === "" ? nameFromHandle(url) : parsed.name,
      headline: parsed.headline,
      snippet: (hit.description ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
    });
    if (out.length >= max) break;
  }
  return out;
}
