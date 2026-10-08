/**
 * Append-only ledger writer shared by ResearchRunWorkflow and VerificationCallWorkflow.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/ledger.ts
 * Deps:    D1 binding (global D1Database type), src/domain/claim
 * Tested:  n/a (thin D1 wrapper; exercised through the Workflows)
 *
 * Key responsibilities:
 * - Insert one ledger_entries row with a per-run monotonic seq assigned inside the INSERT
 * - Retry once on a seq collision, because two Workflows can now append to the same run
 *
 * Design constraints:
 * - Append-only: never update or delete ledger rows
 * - Imports only src/domain, never Next.js
 */
import type { LedgerKind } from "@/domain/claim";

export type LedgerRowInput = {
  step: string;
  kind: LedgerKind;
  cost_usd: number;
  ms: number;
  ref: unknown;
};

function isSeqCollision(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE") || message.includes("PRIMARY KEY");
}

async function insertRow(db: D1Database, runId: string, row: LedgerRowInput): Promise<{ seq: number }> {
  const result = await db
    .prepare(
      `INSERT INTO ledger_entries (run_id, seq, ts, step, kind, cost_usd, ms, ref_json)
       VALUES (?1, (SELECT COALESCE(MAX(seq), 0) + 1 FROM ledger_entries WHERE run_id = ?1), ?2, ?3, ?4, ?5, ?6, ?7)
       RETURNING seq`,
    )
    .bind(
      runId,
      new Date().toISOString(),
      row.step,
      row.kind,
      row.cost_usd,
      row.ms,
      JSON.stringify(row.ref ?? null),
    )
    .first<{ seq: number }>();
  if (!result) throw new Error("ledger insert returned no row");
  return { seq: result.seq };
}

/** Append one ledger row; seq is assigned atomically inside the INSERT. Returns the new seq. */
export async function appendLedger(
  db: D1Database,
  runId: string,
  row: LedgerRowInput,
): Promise<{ seq: number }> {
  try {
    return await insertRow(db, runId, row);
  } catch (error) {
    if (!isSeqCollision(error)) throw error;
    return insertRow(db, runId, row);
  }
}
