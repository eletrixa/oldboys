/**
 * Ledger digest reader: the `ref.digest` a step wrote into its append-only ledger row, parsed with the caller's schema.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/ledger-digest.ts
 * Deps:    zod
 * Tested:  src/domain/__tests__/ledger-digest.test.ts
 *
 * Key responsibilities:
 * - `LedgerRow`: the two ledger columns a digest reader needs (`step`, `ref_json`)
 * - `readDigest`: newest `ref.digest` of one step that parses with the schema; null when absent or malformed
 * - `readDigests`: newest parsing `ref.digest` per step, in first-appearance order (ledger order = recipe order)
 *
 * Design constraints:
 * - Pure, no I/O; malformed rows are skipped, never thrown on; rows without the text "digest" are not JSON-parsed
 */
import type { z } from "zod";

export type LedgerRow = { step?: string | null; ref_json?: string | null };

function digestOf(row: LedgerRow): unknown {
  if (typeof row.ref_json !== "string" || !row.ref_json.includes('"digest"')) return undefined;
  try {
    const ref: unknown = JSON.parse(row.ref_json);
    return typeof ref === "object" && ref !== null && "digest" in ref ? ref.digest : undefined;
  } catch {
    return undefined;
  }
}

/** Latest `ref.digest` of `step` among ledger rows that parses with `schema`; null when absent or malformed. */
export function readDigest<T>(rows: readonly LedgerRow[], step: string, schema: z.ZodType<T>): T | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row?.step !== step) continue;
    const parsed = schema.safeParse(digestOf(row));
    if (parsed.success) return parsed.data;
  }
  return null;
}

/** Newest parsing digest per step; Map order is each step's first appearance, a retried step overwrites its earlier digest. */
export function readDigests<T>(rows: readonly LedgerRow[], schema: z.ZodType<T>): Map<string, T> {
  const byStep = new Map<string, T>();
  for (const row of rows) {
    if (typeof row.step !== "string") continue;
    const digest = digestOf(row);
    if (digest === undefined) continue;
    const parsed = schema.safeParse(digest);
    if (parsed.success) byStep.set(row.step, parsed.data);
  }
  return byStep;
}
