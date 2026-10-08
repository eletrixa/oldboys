/**
 * GET /api/roles: hiring runs grouped by role with evidence coverage per must-have (idea #16).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/roles/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), binding DB, secret RUN_TOKEN, src/domain/role-overview
 * Tested:  projection in src/domain/__tests__/role-overview.test.ts; route n/a
 *
 * Key responsibilities:
 * - Bearer auth against RUN_TOKEN (401/503 like POST /api/runs)
 * - One D1 read: hiring investigations with a role, their brief and confirmed (identity merged) source count
 * - roleOverview over the rows; never cached
 *
 * Design constraints:
 * - No runtime = "edge"
 * - Auth is required here, unlike GET /api/runs/:id: a list enumerates every run id and name, the UUID is no longer the secret
 * - Unconfirmed (namesake) sources are never counted or returned
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireBearer } from "@/app/api/_lib/auth";
import { type RoleRunRow, roleOverview } from "@/domain/role-overview";

const MAX_RUNS = 500;

export async function GET(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return denied;

  const rows = await env.DB.prepare(
    `SELECT i.id, i.subject, i.role, i.status, i.created_at, i.questions_json, b.brief_json,
       (SELECT COUNT(*) FROM sources s WHERE s.run_id = i.id AND s.identity = 'merged') AS sources_confirmed
     FROM investigations i LEFT JOIN briefs b ON b.run_id = i.id
     WHERE i.goal = 'hiring' AND i.role IS NOT NULL AND TRIM(i.role) <> ''
     ORDER BY i.created_at DESC LIMIT ?`,
  )
    .bind(MAX_RUNS)
    .all<RoleRunRow>();

  return Response.json({ groups: roleOverview(rows.results) }, { headers: { "Cache-Control": "no-store" } });
}
