/**
 * Same-origin browser check for session routes (CSRF filter on top of SameSite=Lax).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/same-origin.ts
 * Deps:    none
 * Tested:  src/app/api/_lib/__tests__/same-origin.test.ts
 *
 * Key responsibilities:
 * - Sec-Fetch-Site must be same-origin; for state-changing methods Origin must also match Host
 * - GET/HEAD accept Sec-Fetch-Site alone, because browsers send no Origin on same-origin GETs
 * - rejectCrossOrigin: the shared 403 {error:"browser only"} response, or null when the request passes
 *
 * Design constraints:
 * - Browser-set headers; a script can forge them, so this is never the only brake (rate limits and the session cookie are)
 */
const SAFE_METHODS = new Set(["GET", "HEAD"]);

export function isSameOriginBrowserRequest(request: Request): boolean {
  if (request.headers.get("Sec-Fetch-Site") !== "same-origin") return false;
  if (SAFE_METHODS.has(request.method)) return true;
  const origin = request.headers.get("Origin");
  const host = request.headers.get("Host");
  return origin !== null && host !== null && origin.endsWith(`//${host}`);
}

export function rejectCrossOrigin(request: Request): Response | null {
  return isSameOriginBrowserRequest(request) ? null : Response.json({ error: "browser only" }, { status: 403 });
}
