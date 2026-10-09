/**
 * GET /api/intake/applications: the operator's intake queue (curl, no UI page), last 200 applications newest first.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/intake/applications/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), binding DB, secret RUN_TOKEN, src/app/intake/intake-rows (type)
 * Tested:  labels in src/app/intake/__tests__/intake-rows.test.ts; route n/a (QA pass, like /api/roles)
 *
 * Key responsibilities:
 * - Bearer auth against RUN_TOKEN (401/503 like GET /api/roles)
 * - One D1 read of the queue columns only (no external_id, linkedin_url or cv_key); never cached
 *
 * Design constraints:
 * - No runtime = "edge"
 * - The column list is explicit and never includes cv_text or cover_letter: this is a queue, not a dossier
 * - Auth is required: rows carry names, emails and run ids
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireBearer } from "@/app/api/_lib/auth";
import type { ApplicationListRow } from "@/app/intake/intake-rows";

const MAX_ROWS = 200;

export async function GET(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return denied;

  const rows = await env.DB.prepare(
    `SELECT id, source, tag, name, email, status, run_id, note, received_at
     FROM applications ORDER BY received_at DESC, id DESC LIMIT ?`,
  )
    .bind(MAX_ROWS)
    .all<ApplicationListRow>();

  return Response.json({ applications: rows.results }, { headers: { "Cache-Control": "no-store" } });
}
