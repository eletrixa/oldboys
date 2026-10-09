/**
 * Plain-words progress lines shared by the run page and the tray (plans/015).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/progress-text.ts
 * Deps:    src/domain/run-eta, src/domain/run-cost (formatDuration), ./state (readingText, startedAgo, RowState)
 * Tested:  src/app/runs/[id]/__tests__/progress-text.test.ts
 *
 * Key responsibilities:
 * - timeLine: the one sentence about time for the run's status (running: remaining range + elapsed; paused: waiting for
 *   the answer; longer than usual: no number; queued: typical total; failed: stopped after N; done: null, the panel shows the cost line)
 * - phaseDetails: the right-hand note per phase row (measured time, what is read or done now, "next: …" while paused, typical time)
 * - foundSoFar: "12 public mentions · 2 accounts confirmed · 1 awaiting your answer", null before anything was found
 * - trayLine: the short tray version: "About 3 min left · reading LinkedIn, X and 5 more"
 * - typicalText: "~1 min" / "~40 s"
 *
 * Design constraints:
 * - Pure; the clock comes in as nowMs; "Started N min ago" stays the fallback wording when no range can be given
 */
import { formatDuration } from "@/domain/run-cost";
import { type ProgressView, remainingText, type RunProgress } from "@/domain/run-eta";
import { readingText, type RowState, type RunState, startedAgo } from "./state";

export const LONGER_TEXT = "Taking longer than usual, still working";
export const PAUSED_TEXT = "Paused until you answer the question below";

/** "~40 s" / "~2 min" for a typical phase time. */
export function typicalText(ms: number): string {
  if (ms < 60_000) return `~${String(Math.max(5, Math.round(ms / 5000) * 5))} s`;
  return `~${String(Math.round(ms / 60_000))} min`;
}

function elapsedIn(state: Pick<RunState, "created_at">, nowMs: number): string | null {
  const ms = nowMs - Date.parse(state.created_at);
  return Number.isFinite(ms) && ms >= 0 ? `${formatDuration(ms)} in` : null;
}

export function timeLine(view: ProgressView, state: Pick<RunState, "status" | "created_at" | "cost">, nowMs: number): string | null {
  if (state.status === "paused") return PAUSED_TEXT;
  if (state.status === "done") return null;
  if (state.status === "failed") return `Stopped after ${formatDuration(state.cost.duration_ms)}`;
  const elapsed = elapsedIn(state, nowMs);
  if (view.longer) return elapsed === null ? LONGER_TEXT : `${LONGER_TEXT} · ${elapsed}`;
  const left = remainingText(view);
  if (left === null) return startedAgo(state.created_at, nowMs);
  const sentence = left.charAt(0).toUpperCase() + left.slice(1);
  return elapsed === null ? sentence : `${sentence} · ${elapsed}`;
}

export function phaseDetails(progress: RunProgress, view: ProgressView, rows: readonly RowState[], paused = false): (string | null)[] {
  return progress.phases.map((phase, i) => {
    const row = rows[i];
    if (row === "skipped") return null;
    if (row === "done" || (phase.ended_at !== null && phase.started_at !== null)) {
      const took = phase.ended_at !== null && phase.started_at !== null ? Date.parse(phase.ended_at) - Date.parse(phase.started_at) : Number.NaN;
      return Number.isFinite(took) && took >= 0 ? formatDuration(took) : null;
    }
    if (row === "active" && phase.key === view.active) {
      if (phase.key === "search" || phase.key === "read") {
        const reading = readingText(view.reading);
        if (reading === null) return typicalText(phase.typical_ms);
        // Unfinished steps are being read or queued behind the window of 6: "still to read" claims no more than that
        return paused ? `next: ${reading}` : phase.done > 0 ? `still to read: ${reading}` : `reading ${reading}`;
      }
      const first = view.reading[0];
      if (paused) return typicalText(phase.typical_ms);
      return (first === undefined ? null : ACTIVE_DETAIL[first]) ?? typicalText(phase.typical_ms);
    }
    if (row === "failed") return null;
    return phase.steps === 0 ? null : typicalText(phase.typical_ms);
  });
}

/** What a model phase is doing right now, by its first open step. */
const ACTIVE_DETAIL: Readonly<Record<string, string>> = {
  resolve_lineup: "comparing the profiles found",
  extract_claims: "pulling facts from every source",
  verify_claims: "checking each fact against the others",
  synthesize_report: "writing",
};

export function foundSoFar(state: Pick<RunState, "mentions" | "candidates">): string | null {
  const parts: string[] = [];
  if (state.mentions > 0) parts.push(`${String(state.mentions)} public ${state.mentions === 1 ? "mention" : "mentions"}`);
  const confirmed = state.candidates.filter((c) => c.decision === "merge").length;
  const open = state.candidates.filter((c) => c.decision === "possibly-same-as").length;
  if (confirmed > 0) parts.push(`${String(confirmed)} ${confirmed === 1 ? "account" : "accounts"} confirmed`);
  if (open > 0) parts.push(`${String(open)} awaiting your answer`);
  return parts.length === 0 ? null : `Found so far: ${parts.join(" · ")}`;
}

/** The tray's one line under the dots; null when the status pill already says it all (done, failed). */
export function trayLine(view: ProgressView, state: Pick<RunState, "status" | "created_at" | "cost" | "mentions">, nowMs: number): string | null {
  if (state.status === "done" || state.status === "failed") return null;
  if (state.status === "paused") return "Answer one question to continue";
  const time = view.longer ? "Longer than usual" : (remainingText(view) ?? startedAgo(state.created_at, nowMs));
  const reading = view.active === "search" || view.active === "read" ? readingText(view.reading, 2) : null;
  const doing = view.active === "lineup" ? "checking identity" : view.active === "check" ? "double-checking facts" : view.active === "write" ? "writing the brief" : reading === null ? null : `still to read: ${reading}`;
  const head = time === null ? null : time.charAt(0).toUpperCase() + time.slice(1);
  return [head, doing].filter((x): x is string => x !== null).join(" · ");
}
