/**
 * Canonical form of a source URL, so the same page counts as one source.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/url.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/url.test.ts
 *
 * Key responsibilities:
 * - canonicalUrl: lowercase host, no fragment, no trailing slash, no `locale`/`l` query parameters
 *
 * Design constraints:
 * - Pure; a string that is not a URL comes back trimmed and unchanged
 */

const NOISE_PARAMS = ["locale", "l"];

export function canonicalUrl(url: string): string {
  const raw = url.trim();
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  for (const p of NOISE_PARAMS) u.searchParams.delete(p);
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : "";
  return `${u.protocol}//${u.host}${path}${u.search}`;
}
