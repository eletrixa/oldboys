/**
 * D1 loader for the GDPR audit record of one run (shared by the JSON route and the audit page).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/audit/load.ts
 * Deps:    D1Database, src/domain/audit, src/recipe/goals
 * Tested:  n/a (I/O only; the projection is tested in src/domain/__tests__/audit.test.ts)
 *
 * Key responsibilities:
 * - Read the investigation head, ledger (seq order), gaps, lineup candidates (id, platform, title) and calls
 *   (status, provider, times) and project them with auditRecord
 * - organization_name comes from LEFT JOIN organizations on investigations.organization_id
 * - started_by_name comes from LEFT JOIN accounts on investigations.account_id (name only, never the e-mail)
 * - Recipe steps come from recipeFor(goal); an unknown goal yields no source rows
 *
 * Design constraints:
 * - Selects only the columns the record needs: no excerpts, claims, profile URLs or phone numbers
 */
import { type AuditCall, type AuditCandidate, type AuditGap, type AuditLedgerRow, type AuditRecord, type AuditRun, auditRecord } from "@/domain/audit";
import { GoalId } from "@/domain/claim";
import { recipeFor } from "@/recipe/goals";

/** null when the run does not exist (or was already purged). */
export async function loadAuditRecord(db: D1Database, id: string, now: Date): Promise<AuditRecord | null> {
  const run = await db
    .prepare("SELECT i.id, i.subject, i.anchor, i.goal, i.role, i.status, i.via, i.source_url, i.created_at, o.name AS organization_name, a.name AS started_by_name FROM investigations i LEFT JOIN organizations o ON o.id = i.organization_id LEFT JOIN accounts a ON a.id = i.account_id WHERE i.id = ?")
    .bind(id)
    .first<AuditRun>();
  if (!run) return null;

  const [ledger, gaps, candidates, calls] = await Promise.all([
    db.prepare("SELECT step, ts, kind, cost_usd, ms, ref_json FROM ledger_entries WHERE run_id = ? ORDER BY seq").bind(id).all<AuditLedgerRow>(),
    db.prepare("SELECT question_id, reason FROM gaps WHERE run_id = ?").bind(id).all<AuditGap>(),
    db.prepare("SELECT id, platform, name FROM candidates WHERE run_id = ?").bind(id).all<AuditCandidate>(),
    db.prepare("SELECT status, provider, created_at, finished_at FROM calls WHERE run_id = ? ORDER BY created_at").bind(id).all<AuditCall>(),
  ]);

  const goal = GoalId.safeParse(run.goal);
  return auditRecord({
    run,
    steps: goal.success ? recipeFor(goal.data).steps : [],
    ledger: ledger.results,
    gaps: gaps.results,
    candidates: candidates.results,
    calls: calls.results,
    now: now.toISOString(),
  });
}
