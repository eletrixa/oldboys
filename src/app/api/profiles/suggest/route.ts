/**
 * GET /api/profiles/suggest?q=<name>&hint=<company or city>: public LinkedIn profile suggestions for the start form.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/profiles/suggest/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), src/app/api/_lib/{same-origin,session,auth-store}, src/adapters/fetch, handler.ts
 * Tested:  src/app/api/profiles/__tests__/suggest.test.ts (handler)
 *
 * Key responsibilities:
 * - Same-origin browser check (403), session cookie (401), SUGGEST_PER_HOUR_PER_ACCOUNT lookups per account (429), then suggestProfiles
 * - Every response gets Cache-Control: no-store in one place
 *
 * Design constraints:
 * - No runtime = "edge"; every lookup counts toward the cap, cached or not; the key never reaches the browser
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { recordAttempt, throttled } from "@/app/api/_lib/auth-store";
import { rejectCrossOrigin } from "@/app/api/_lib/same-origin";
import { sessionFromRequest, unauthorized } from "@/app/api/_lib/session";
import { suggestProfiles } from "@/app/api/profiles/suggest/handler";
import { fetchJson } from "@/adapters/fetch";
import { HOUR_MS, SUGGEST_PER_HOUR_PER_ACCOUNT } from "@/domain/auth-limits";

async function suggest(request: Request): Promise<Response> {
  const denied = rejectCrossOrigin(request);
  if (denied !== null) return denied;
  const { env } = getCloudflareContext();
  const user = await sessionFromRequest(request, env.DB);
  if (user === null) return unauthorized();
  const now = new Date();
  if (await throttled(env.DB, "suggest", user.accountId, HOUR_MS, SUGGEST_PER_HOUR_PER_ACCOUNT, now)) {
    return Response.json({ error: "too many lookups" }, { status: 429 });
  }
  await recordAttempt(env.DB, "suggest", user.accountId, now.toISOString());
  const params = new URL(request.url).searchParams;
  return suggestProfiles(params.get("q") ?? "", params.get("hint") ?? "", { fetchJson, key: env.BRAVE_SEARCH_KEY ?? "" });
}

export async function GET(request: Request): Promise<Response> {
  const res = await suggest(request);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
