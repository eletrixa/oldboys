/**
 * Briefs list data: runs started by an organization, newest first, and their grouping by position.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/load.ts
 * Deps:    D1 (type only)
 * Tested:  src/app/briefs/__tests__/load.test.ts (groupByPosition, statusOf)
 *
 * Key responsibilities:
 * - listOrganizationRuns: one query scoped to organization_id, joined to the starting account, the position and the
 *   brief's fit % (json_extract of profile.position_fit[0].fit_pct, so the brief JSON never leaves D1)
 * - groupByPosition: position groups in order of their newest run, "No position" last
 * - statusOf: plain label and tone for a run status; "Stalled, start again" when running with no ledger row for 30 min
 *
 * Design constraints:
 * - Reads only; never returns another organization's rows
 * - Fit is the evidence share of the position's must-haves; rows are never sorted by it
 */
import { isStalled } from "@/domain/run-status";

export type BriefRow = {
  id: string;
  subject: string;
  role: string | null;
  status: string;
  created_at: string;
  started_by: string | null;
  position_id: string | null;
  position_title: string | null;
  fit_pct: number | null;
  last_at: string;
};

export async function listOrganizationRuns(db: D1Database, organizationId: string, limit = 200): Promise<BriefRow[]> {
  const { results } = await db
    .prepare(
      `SELECT i.id, i.subject, i.role, i.status, i.created_at, a.name AS started_by, p.id AS position_id, p.title AS position_title,
              json_extract(b.brief_json, '$.profile.position_fit[0].fit_pct') AS fit_pct,
              COALESCE((SELECT MAX(l.ts) FROM ledger_entries l WHERE l.run_id = i.id), i.created_at) AS last_at
       FROM investigations i
       LEFT JOIN accounts a ON a.id = i.account_id
       LEFT JOIN positions p ON p.id = i.position_id
       LEFT JOIN briefs b ON b.run_id = i.id
       WHERE i.organization_id = ? ORDER BY i.created_at DESC LIMIT ?`,
    )
    .bind(organizationId, limit)
    .all<BriefRow>();
  return results;
}

export type BriefGroup = { key: string; title: string; positionId: string | null; rows: BriefRow[] };

/** Groups keep the newest-first order of the rows; runs without a (still stored) position go to "No position", last. */
export function groupByPosition(rows: readonly BriefRow[]): BriefGroup[] {
  const groups = new Map<string, BriefGroup>();
  for (const r of rows) {
    const key = r.position_id ?? "";
    const group = groups.get(key) ?? { key, title: r.position_title ?? "No position", positionId: r.position_id, rows: [] };
    group.rows.push(r);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => Number(a.positionId === null) - Number(b.positionId === null));
}

export function statusOf(status: string, lastAt?: string, nowIso = new Date().toISOString()): { label: string; tone: "ok" | "unsure" | "conflict" | "neutral" } {
  if (status === "done") return { label: "Done", tone: "ok" };
  if (status === "failed") return { label: "Failed", tone: "conflict" };
  if (lastAt !== undefined && isStalled(status, lastAt, nowIso)) return { label: "Stalled, start again", tone: "unsure" };
  if (status === "paused") return { label: "Paused", tone: "unsure" };
  return { label: "Researching", tone: "unsure" };
}
