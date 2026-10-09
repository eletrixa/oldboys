/**
 * Ledger projection: what a research run cost and how long it took, plus the duration label.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/run-cost.ts
 * Deps:    src/domain/report-translation (TRANSLATE_STEP)
 * Tested:  src/domain/__tests__/run-cost.test.ts
 *
 * Key responsibilities:
 * - runCost: sum cost_usd (2 decimals), count source calls and model calls (llm rows' ref.calls, 0 when absent), measure research time
 * - Duration = created_at → latest ledger ts, minus pauses (a 'pause' row until the next non-pause row); a report
 *   translation row (step TRANSLATE_STEP, idea #24) adds its cost and model call but not its time, since it runs later on demand
 * - formatDuration: "Xs", "M min S s" or "H h M min"
 *
 * Design constraints:
 * - Pure: no I/O; rows arrive in seq order from the caller
 * - Invalid dates and negative values clamp to 0, never throw
 */
import { TRANSLATE_STEP } from "./report-translation";

export type RunCost = { usd: number; source_calls: number; llm_calls: number; duration_ms: number };

export type CostRow = { ts: string; kind: string; cost_usd: number; ms: number; ref_json?: string | null; step?: string };

/** Model calls behind one llm row: `ref.calls` as the Workflow wrote it; absent or unreadable counts 0, never a guess. */
function modelCalls(refJson: string | null | undefined): number {
  if (refJson === null || refJson === undefined) return 0;
  try {
    const ref: unknown = JSON.parse(refJson);
    return typeof ref === "object" && ref !== null && "calls" in ref && typeof ref.calls === "number" ? positive(ref.calls) : 0;
  } catch {
    return 0;
  }
}

function positive(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Projects the ledger rows (in seq order) of one run into its cost and research duration. */
export function runCost(rows: readonly CostRow[], createdAt: string): RunCost {
  let usd = 0;
  let source_calls = 0;
  let llm_calls = 0;
  let latest = Number.NaN;
  let pauseStart: number | null = null;
  let paused = 0;

  for (const row of rows) {
    usd += positive(row.cost_usd);
    if (row.kind === "call") source_calls += 1;
    if (row.kind === "llm") llm_calls += modelCalls(row.ref_json);
    if (row.step === TRANSLATE_STEP) continue;

    const t = Date.parse(row.ts);
    if (Number.isNaN(t)) continue;
    if (Number.isNaN(latest) || t > latest) latest = t;
    if (row.kind === "pause") {
      pauseStart ??= t;
    } else if (pauseStart !== null) {
      paused += positive(t - pauseStart);
      pauseStart = null;
    }
  }

  const start = Date.parse(createdAt);
  // Still paused: research time stops at the pause.
  const end = pauseStart ?? latest;
  const duration_ms = Number.isNaN(start) || Number.isNaN(end) ? 0 : positive(end - start - paused);

  return { usd: Math.round(usd * 100) / 100, source_calls, llm_calls, duration_ms };
}

/** Human duration: "45 s", "3 min 12 s" or "1 h 5 min". */
export function formatDuration(ms: number): string {
  const total = Math.floor(positive(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${String(h)} h ${String(m)} min`;
  if (m > 0) return `${String(m)} min ${String(s)} s`;
  return `${String(s)} s`;
}
