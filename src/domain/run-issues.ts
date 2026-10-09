/**
 * Run issues: the problems a run hit so far, read from the append-only ledger (failed requests, budget stops, sources
 * not searched, searched empty, AI unavailable, lineup unanswered), so the research page can show them while it loads.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/run-issues.ts
 * Deps:    src/domain/ledger-digest (LedgerRow type)
 * Tested:  src/domain/__tests__/run-issues.test.ts
 *
 * Key responsibilities:
 * - readRunIssues: one RunIssue per problem, in ledger order: a "request failed: …" or "run budget reached" note of a step
 *   row (ref.notes), a budget skip row (ref.skipped), a gap row (ref.gap + ref.reason; "not searched: …" is its own kind),
 *   a degraded row (ref.degraded), an unanswered lineup row (ref.unanswered + ref.note)
 * - A step whose gap says "not searched" keeps only the gap: its failed-request notes are the same fact and are dropped
 * - The failure row (ref.failed) is not an issue; the state already reports it as `failure`
 *
 * Design constraints:
 * - Pure, no I/O; malformed rows are skipped, never thrown on; reasons are returned as stored (the caller scrubs)
 */
import type { LedgerRow } from "@/domain/ledger-digest";

export type RunIssueKind = "request_failed" | "budget" | "not_searched" | "gap" | "degraded" | "unanswered";

export type RunIssue = { step: string; kind: RunIssueKind; reason: string };

const NOT_SEARCHED = "not searched: ";
const BUDGET = "run budget reached";

function refOf(row: LedgerRow): Record<string, unknown> | null {
  if (typeof row.ref_json !== "string") return null;
  try {
    const ref: unknown = JSON.parse(row.ref_json);
    return typeof ref === "object" && ref !== null ? (ref as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function issuesOf(step: string, ref: Record<string, unknown>): RunIssue[] {
  if (ref.failed === true) return [];
  if (ref.gap === true && typeof ref.reason === "string") {
    const notSearched = ref.reason.startsWith(NOT_SEARCHED);
    return [{ step, kind: notSearched ? "not_searched" : "gap", reason: notSearched ? ref.reason.slice(NOT_SEARCHED.length) : ref.reason }];
  }
  if (typeof ref.skipped === "string") return [{ step, kind: "budget", reason: ref.skipped }];
  if (typeof ref.degraded === "string") return [{ step, kind: "degraded", reason: ref.degraded }];
  if (ref.unanswered === true) return [{ step, kind: "unanswered", reason: typeof ref.note === "string" ? ref.note : "no lineup answer" }];
  if (!Array.isArray(ref.notes)) return [];
  const out: RunIssue[] = [];
  for (const note of ref.notes) {
    if (typeof note !== "string") continue;
    if (note.startsWith("request failed:")) out.push({ step, kind: "request_failed", reason: note });
    else if (note === BUDGET) out.push({ step, kind: "budget", reason: note });
  }
  return out;
}

/** Every problem the ledger recorded so far, in ledger order; [] for a clean run. */
export function readRunIssues(rows: readonly LedgerRow[]): RunIssue[] {
  const items: RunIssue[] = [];
  for (const row of rows) {
    if (typeof row.step !== "string") continue;
    const ref = refOf(row);
    if (ref !== null) items.push(...issuesOf(row.step, ref));
  }
  const notSearched = new Set(items.filter((i) => i.kind === "not_searched").map((i) => i.step));
  return items.filter((i) => !((i.kind === "request_failed" || i.kind === "budget") && notSearched.has(i.step)));
}
