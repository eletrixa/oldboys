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
 * - Responses are never cached by the browser or the edge
 *
 * Design constraints:
 * - No runtime = "edge"; every lookup counts toward the limit, cached or not
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lookupCompany } from "@/app/api/ares/[ico]/handler";
import { countAttempts, recordAttempt } from "@/app/api/_lib/auth-store";
import { isSameOriginBrowserRequest } from "@/app/api/_lib/same-origin";
import { fetchJson } from "@/adapters/fetch";
import { ARES_PER_HOUR_PER_IP, clientIp, HOUR_MS, since } from "@/domain/auth-limits";

export async function GET(request: Request, { params }: { params: Promise<{ ico: string }> }): Promise<Response> {
  if (!isSameOriginBrowserRequest(request)) return Response.json({ error: "browser only" }, { status: 403 });
  const { env } = getCloudflareContext();
  const { ico } = await params;
  const ip = clientIp(request.headers);
  const now = new Date();
  if ((await countAttempts(env.DB, "ares", ip, since(now, HOUR_MS))) >= ARES_PER_HOUR_PER_IP) {
    return Response.json({ error: "too many lookups" }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  await recordAttempt(env.DB, "ares", ip, now.toISOString());
  const res = await lookupCompany(ico, { db: env.DB, fetchJson, now: () => new Date() });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
