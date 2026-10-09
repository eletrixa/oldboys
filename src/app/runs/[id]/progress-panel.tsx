/**
 * Progress panel for the run page: the five phases with what each is doing, how long it took or typically takes, the
 * remaining-time range and what was found so far (plans/015).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/progress-panel.tsx
 * Deps:    react, src/domain/run-eta, src/domain/run-cost (formatDuration), ../../ui, ./parts (ProgressSteps), ./state, ./progress-text
 * Tested:  the text and arithmetic in ./__tests__/progress-text.test.ts and src/domain/__tests__/run-eta.test.ts; rendering QA'd in the browser
 *
 * Key responsibilities:
 * - Time line: "About 2 to 4 min left · 1 min 10 s in" while running, "Waiting for your answer" while paused, "Taking longer
 *   than usual, still working" past 2.5x the phase's typical time, "Took 3 min 20 s" when done
 * - Row details: a finished phase shows its measured time, the active one what it is reading now, the rest "~1 min"
 * - "Found so far": public mentions, accounts confirmed, accounts awaiting an answer
 * - Payloads without `progress` (older runs) fall back to the step-index bar and the "Started N min ago" line
 *
 * Design constraints:
 * - Pure rendering from `state` and `nowMs`; the 1 s clock is the caller's (useNow)
 * - Honest wording: a range or nothing; never a percentage of "certainty", never a point estimate
 */
"use client";

import { formatDuration } from "@/domain/run-cost";
import { progressView } from "@/domain/run-eta";
import type { RunState } from "./state";
import { firstName, phaseLabels, startedAgo, stepRows } from "./state";
import { ProgressSteps } from "./parts";
import { foundSoFar, phaseDetails, timeLine } from "./progress-text";

export function ProgressPanel({ state, nowMs, degraded }: { state: RunState; nowMs: number; degraded: boolean }): React.JSX.Element {
  const rows = stepRows({ ...state, degraded });
  const labels = phaseLabels(firstName(state.subject), state.mentions, degraded);
  const running = state.status !== "done" && state.status !== "failed";
  if (state.progress === undefined) {
    return <ProgressSteps rows={rows} labels={labels} stepIndex={state.step_index} stepCount={state.step_count} foot={running ? <p className="text-sm text-muted">{startedAgo(state.created_at, nowMs)}</p> : null} />;
  }
  const view = progressView(state.progress, state.status, nowMs);
  const line = timeLine(view, state, nowMs);
  const found = foundSoFar(state);
  return (
    <ProgressSteps
      rows={rows}
      labels={labels}
      details={phaseDetails(state.progress, view, rows, state.status === "paused")}
      share={view.share}
      stepIndex={state.step_index}
      stepCount={state.step_count}
      foot={
        <div className="flex flex-col gap-1 text-sm text-muted tabular-nums">
          {line !== null && <p className={view.longer ? "text-unsure" : undefined}>{line}</p>}
          {found !== null && <p>{found}</p>}
          {state.status === "done" && <p>Took {formatDuration(state.cost.duration_ms)} of research time.</p>}
        </div>
      }
    />
  );
}
