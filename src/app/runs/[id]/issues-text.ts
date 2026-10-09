/**
 * Plain-word lines for the issues a run hit so far: a counts summary and one line per issue.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/issues-text.ts
 * Deps:    src/domain/run-issues (type), ./state (GAP_LABEL, gapText)
 * Tested:  src/app/runs/[id]/__tests__/issues-text.test.ts
 *
 * Key responsibilities:
 * - issueCounts: failed requests, sources skipped (budget or not searched), searched empty, AI off, lineup unanswered
 * - issueSummary: "2 requests failed · 1 source skipped · 3 searched, nothing found"; null for a clean run
 * - issueLine: "LinkedIn posts: not searched, the service refused our request (HTTP 401)" (step label, reason in plain words)
 *
 * Design constraints:
 * - Pure; counts only, never a verdict; raw reasons stay for the hover title (already scrubbed by the route)
 */
import type { RunIssue } from "@/domain/run-issues";
import { GAP_LABEL, gapText } from "./state";

export type IssueCounts = { failed: number; skipped: number; empty: number; degraded: number; unanswered: number };

export function issueCounts(issues: readonly RunIssue[]): IssueCounts {
  const c: IssueCounts = { failed: 0, skipped: 0, empty: 0, degraded: 0, unanswered: 0 };
  for (const i of issues) {
    if (i.kind === "request_failed") c.failed += 1;
    else if (i.kind === "budget" || i.kind === "not_searched") c.skipped += 1;
    else if (i.kind === "gap") c.empty += 1;
    else if (i.kind === "degraded") c.degraded += 1;
    else c.unanswered += 1;
  }
  return c;
}

const n = (count: number, one: string, many: string): string => `${String(count)} ${count === 1 ? one : many}`;

/** One line of counts, worst first; null when there is nothing to report. */
export function issueSummary(issues: readonly RunIssue[]): string | null {
  const c = issueCounts(issues);
  const parts = [
    c.failed > 0 ? n(c.failed, "request failed", "requests failed") : null,
    c.skipped > 0 ? n(c.skipped, "source skipped", "sources skipped") : null,
    c.empty > 0 ? `${String(c.empty)} searched, nothing found` : null,
    c.degraded > 0 ? "AI unavailable" : null,
    c.unanswered > 0 ? "lineup unanswered" : null,
  ].filter((p): p is string => p !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

/** Human step name: the gap label, else the step id. */
export const issueStep = (step: string): string => GAP_LABEL[step] ?? step;

/** The reason in plain words, with what happened to the step. */
export function issueText(i: RunIssue): string {
  switch (i.kind) {
    case "request_failed":
      return gapText(i.reason);
    case "budget":
      return "skipped, the run budget was reached";
    case "not_searched":
      return `not searched, ${gapText(i.reason)}`;
    case "degraded":
      return `AI unavailable (${i.reason})`;
    case "gap":
    case "unanswered":
      return gapText(i.reason);
  }
}

export const issueLine = (i: RunIssue): string => `${issueStep(i.step)}: ${issueText(i)}`;
