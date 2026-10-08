/**
 * GET /api/ares/:ico: company lookup for the registration form.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/ares/[ico]/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), src/app/api/_lib/{same-origin,auth-store}, src/adapters/fetch, handler.ts
 * Tested:  src/app/api/ares/__tests__/lookup.test.ts (handler)
 *
 * Key responsibilities:
 * - Same-origin browser check (403), then 30 lookups per hour per IP (429), then lookupCompany
 * - Every response, 403 and 429 included, gets Cache-Control: no-store in one place
 *
 * Design constraints:
 * - No runtime = "edge"; every lookup counts toward the limit, cached or not
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lookupCompany } from "@/app/api/ares/[ico]/handler";
import { recordAttempt, throttled } from "@/app/api/_lib/auth-store";
import { rejectCrossOrigin } from "@/app/api/_lib/same-origin";
import { fetchJson } from "@/adapters/fetch";
import { ARES_PER_HOUR_PER_IP, clientIp, HOUR_MS } from "@/domain/auth-limits";

async function lookup(request: Request, params: Promise<{ ico: string }>): Promise<Response> {
  const denied = rejectCrossOrigin(request);
  if (denied !== null) return denied;
  const { env } = getCloudflareContext();
  const { ico } = await params;
  const ip = clientIp(request.headers);
  const now = new Date();
  if (await throttled(env.DB, "ares", ip, HOUR_MS, ARES_PER_HOUR_PER_IP, now)) {
    return Response.json({ error: "too many lookups" }, { status: 429 });
  }
  await recordAttempt(env.DB, "ares", ip, now.toISOString());
  return lookupCompany(ico, { db: env.DB, fetchJson, now: () => new Date() });
}

export async function GET(request: Request, { params }: { params: Promise<{ ico: string }> }): Promise<Response> {
  const res = await lookup(request, params);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
