/**
 * Hiring runs as the candidates overview reads them: one SELECT shared by GET /api/roles and GET /api/positions/:id.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/role-rows.ts
 * Deps:    src/domain/role-overview (RoleRunRow type)
 * Tested:  src/app/api/positions/__tests__/handler.test.ts (via getPosition); GET /api/roles n/a
 *
 * Key responsibilities:
 * - `loadRoleRunRows`: investigations joined with their brief, the count of identity-merged sources and the last ledger step
 *   (not the "run" failure row; the position results table shows progress from it), newest first, capped
 *
 * Design constraints:
 * - Only identity-merged sources are counted; namesake hits never reach the overview
 * - `where` is a fixed SQL fragment written by the caller, never user input; values go through `binds`
 */
import type { RoleRunRow } from "@/domain/role-overview";

export const MAX_ROLE_RUNS = 500;

export const ROLE_RUN_ROWS_SELECT = `SELECT i.id, i.subject, i.role, i.status, i.created_at, i.questions_json, b.brief_json,
       (SELECT COUNT(*) FROM sources s WHERE s.run_id = i.id AND s.identity = 'merged') AS sources_confirmed,
       (SELECT l.step FROM ledger_entries l WHERE l.run_id = i.id AND l.step <> 'run' ORDER BY l.seq DESC LIMIT 1) AS last_step
     FROM investigations i LEFT JOIN briefs b ON b.run_id = i.id`;

export async function loadRoleRunRows(db: D1Database, where: string, binds: readonly unknown[] = []): Promise<RoleRunRow[]> {
  const { results } = await db
    .prepare(`${ROLE_RUN_ROWS_SELECT} WHERE ${where} ORDER BY i.created_at DESC LIMIT ?`)
    .bind(...binds, MAX_ROLE_RUNS)
    .all<RoleRunRow>();
  return results;
}
