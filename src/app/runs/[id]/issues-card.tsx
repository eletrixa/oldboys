/**
 * "Issues so far" card for the research page: counts plus one line per problem the run hit, shown while it loads.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/issues-card.tsx
 * Deps:    react, ../../ui, ./issues-text, src/domain/run-issues (type)
 * Tested:  src/app/runs/[id]/__tests__/issues-card.test.ts
 *
 * Key responsibilities:
 * - Nothing for a clean run; otherwise a status region with the counts line and the issue lines (raw reason on hover)
 * - Announced once per change (role="status", polite), never per poll tick when nothing changed (React keeps the DOM)
 *
 * Design constraints:
 * - Pure rendering; the failed state keeps its own alert, this card lists the step-level problems under it
 * - Radar tokens only: the unsure card (something to know, not an error of the brief)
 */
"use client";

import type { RunIssue } from "@/domain/run-issues";
import { CARD_UNSURE } from "../../ui";
import { issueLine, issueSummary } from "./issues-text";

export function IssuesCard({ issues }: { issues: readonly RunIssue[] }): React.JSX.Element | null {
  const summary = issueSummary(issues);
  if (summary === null) return null;
  return (
    <section role="status" aria-label="Issues so far" className={`${CARD_UNSURE} flex flex-col gap-2 text-sm`}>
      <p className="font-medium tabular-nums">Issues so far: {summary}</p>
      <ul className="flex flex-col gap-1 text-muted">
        {issues.map((i, n) => (
          <li key={`${i.step}-${String(n)}`} title={i.reason}>{issueLine(i)}</li>
        ))}
      </ul>
      <p className="text-muted">The brief says what was not searched. A skipped source is a gap, never a mark against the person.</p>
    </section>
  );
}
