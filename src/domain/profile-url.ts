/**
 * LinkedIn profile URL normalisation and a display name guessed from its handle (plans/006 profile-first start).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/profile-url.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/profile-url.test.ts
 *
 * Key responsibilities:
 * - `normalizeLinkedinProfile`: any linkedin.com/in/<handle> form (country host, no scheme, query, locale suffix)
 *   -> https://www.linkedin.com/in/<handle>; null for anything else (company pages, posts, other hosts)
 * - `nameFromHandle`: "josef-buryan-4a1b2c3" -> "Josef Buryan", the subject when the profile could not be scraped
 *
 * Design constraints:
 * - Pure; shared by POST /api/runs (validation) and the seed seam
 */

export function normalizeLinkedinProfile(raw: string): string | null {
  const text = raw.trim();
  if (text === "" || /\s/.test(text)) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
  const seg = u.pathname.split("/").filter(Boolean);
  if (seg[0] !== "in" || seg[1] === undefined) return null;
  let handle: string;
  try {
    handle = decodeURIComponent(seg[1]).toLowerCase();
  } catch {
    return null;
  }
  if (!/^[\p{L}\p{N}_-]{2,100}$/u.test(handle)) return null;
  return `https://www.linkedin.com/in/${encodeURIComponent(handle)}`;
}

/** Title-cased words of the handle, dropping LinkedIn's numeric/hex suffix segments; "" when nothing name-like is left. */
export function nameFromHandle(profileUrl: string): string {
  let handle: string;
  try {
    handle = decodeURIComponent(profileUrl.split("/in/")[1]?.split(/[/?#]/)[0] ?? "");
  } catch {
    return "";
  }
  return handle
    .split(/[-_]+/)
    .filter((w) => w.length > 0 && !/\d/.test(w))
    .map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`)
    .join(" ");
}
