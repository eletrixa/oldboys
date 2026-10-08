/**
 * Shared bearer-token check for operator routes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/auth.ts
 * Deps:    src/domain/timing-safe-equal
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Constant-time comparison of the Authorization bearer against the RUN_TOKEN secret
 * - requireBearer: 503 when the secret is unset, 401 when wrong, null when OK
 *
 * Design constraints:
 * - No runtime = "edge"; no logging of tokens
 */
import { timingSafeEqual } from "@/domain/timing-safe-equal";

function isAuthorized(request: Request, token: string): boolean {
  const header = request.headers.get("Authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return presented.length > 0 && timingSafeEqual(presented, token);
}

/** Returns an error Response when the request must be rejected, or null when authorized. */
export function requireBearer(request: Request, token: string | undefined): Response | null {
  if (token === undefined || token.length === 0) {
    return Response.json({ error: "RUN_TOKEN secret is not configured" }, { status: 503 });
  }
  if (!isAuthorized(request, token)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
