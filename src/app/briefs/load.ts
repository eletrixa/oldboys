/**
 * Briefs list data: runs started by an organization, newest first.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/load.ts
 * Deps:    D1 (type only)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - listOrganizationRuns: one query scoped to organization_id, joined to the account that started each run
 *
 * Design constraints:
 * - Reads only; never returns another organization's rows
 */
export type BriefRow = {
  id: string;
  subject: string;
  role: string | null;
  status: string;
  created_at: string;
  started_by: string | null;
};

export async function listOrganizationRuns(db: D1Database, organizationId: string, limit = 200): Promise<BriefRow[]> {
  const { results } = await db
    .prepare(
      "SELECT i.id, i.subject, i.role, i.status, i.created_at, a.name AS started_by FROM investigations i LEFT JOIN accounts a ON a.id = i.account_id WHERE i.organization_id = ? ORDER BY i.created_at DESC LIMIT ?",
    )
    .bind(organizationId, limit)
    .all<BriefRow>();
  return results;
}
