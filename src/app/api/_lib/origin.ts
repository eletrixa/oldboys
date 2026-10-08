/**
 * Same-origin browser check shared by the public form endpoints (/api/start, /api/apply).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/origin.ts
 * Deps:    none
 * Tested:  src/app/api/_lib/__tests__/origin.test.ts
 *
 * Key responsibilities:
 * - `fromOurPage`: true when Sec-Fetch-Site is same-origin and Origin ends with the request's Host
 *
 * Design constraints:
 * - Browser-set headers that a script can forge: a first filter only, never the sole brake (hourly caps are)
 */

export function fromOurPage(request: Request): boolean {
  const origin = request.headers.get("Origin");
  const host = request.headers.get("Host");
  const sameOrigin = request.headers.get("Sec-Fetch-Site") === "same-origin";
  return sameOrigin && origin !== null && host !== null && origin.endsWith(`//${host}`);
}
