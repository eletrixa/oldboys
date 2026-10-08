/**
 * Same-origin browser check for state-changing session routes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/same-origin.ts
 * Deps:    none
 * Tested:  n/a
 *
 * Key responsibilities:
 * - True only when Origin matches Host and Sec-Fetch-Site is same-origin
 *
 * Design constraints:
 * - Browser-set headers; a script can forge them, so this is a CSRF filter on top of SameSite=Lax, never the only brake
 */
export function isSameOriginBrowserRequest(request: Request): boolean {
  const origin = request.headers.get("Origin");
  const host = request.headers.get("Host");
  const sameOrigin = request.headers.get("Sec-Fetch-Site") === "same-origin";
  return sameOrigin && origin !== null && host !== null && origin.endsWith(`//${host}`);
}
