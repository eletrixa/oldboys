/**
 * Canonical form of a source URL, so the same page counts as one source.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/url.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/url.test.ts
 *
 * Key responsibilities:
 * - canonicalUrl: lowercase host, no fragment, no trailing slash, no locale (`locale`, `l`) or tracking (`srsltid`,
 *   `utm_*`, `fbclid`, `igsh`) query parameters; LinkedIn country hosts fold to www.linkedin.com and a locale suffix
 *   (`/in/<handle>/cs`) is dropped, mirroring `profileKey` in src/recipe/seams/resolve.ts
 * - httpUrl: the URL normalised, or null unless it parses as http(s) (so a malformed value never renders a javascript: link)
 *
 * Design constraints:
 * - Pure; a string that is not a URL comes back trimmed and unchanged
 */

const NOISE_PARAMS = new Set(["locale", "l", "srsltid", "fbclid", "igsh"]);

const isNoiseParam = (name: string): boolean => NOISE_PARAMS.has(name) || name.startsWith("utm_");

export function canonicalUrl(url: string): string {
  const raw = url.trim();
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  for (const p of [...u.searchParams.keys()].filter(isNoiseParam)) u.searchParams.delete(p);
  let host = u.host;
  let path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : "";
  if (/(^|\.)linkedin\.com$/.test(host)) {
    host = "www.linkedin.com";
    path = path.replace(/^(\/in\/[^/]+)\/[a-z]{2}$/i, "$1");
  }
  return `${u.protocol}//${host}${path}${u.search}`;
}

/** The URL normalised, or null unless it parses as http(s). */
export function httpUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
