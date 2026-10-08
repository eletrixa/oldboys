/**
 * Polling decisions: which tracked runs to check, what a status change means for the user.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/src/lib/poll.ts
 * Deps:    zod, @domain/run-status
 * Tested:  extension/src/lib/__tests__/poll.test.ts
 *
 * Key responsibilities:
 * - TrackedRun: the extension's projection of one investigation (truth stays in D1)
 * - dueRuns: non-terminal runs only
 * - transition: previous → next status → optional notification text and the updated run
 * - badgeText: count of runs that need the user (paused, or done and not yet opened)
 *
 * Design constraints:
 * - Pure functions; the background wires them to alarms, fetch and notifications
 * - Notification options stay within Firefox's supported subset (type basic, title, message, iconUrl)
 */
import { z } from "zod";
import { GoalId, InvestigationStatus } from "@domain/claim";
import { type RunStatus } from "@domain/run-status";

export const TrackedRun = z.object({
  runId: z.string().min(1),
  subject: z.string().min(1),
  goal: GoalId,
  sourceUrl: z.url(),
  status: InvestigationStatus,
  facts: z.number().int().nonnegative(),
  inferences: z.number().int().nonnegative(),
  gaps: z.number().int().nonnegative(),
  candidates: z.number().int().nonnegative(),
  opened: z.boolean(),
  startedAt: z.string().min(1),
  checkedAt: z.string().nullable(),
});
export type TrackedRun = z.infer<typeof TrackedRun>;

export type Notice = { title: string; message: string };

const TERMINAL = new Set<InvestigationStatus>(["done", "failed"]);

export function dueRuns(runs: readonly TrackedRun[]): TrackedRun[] {
  return runs.filter((r) => !TERMINAL.has(r.status));
}

export function applyStatus(run: TrackedRun, next: RunStatus, now: Date): TrackedRun {
  return {
    ...run,
    status: next.status,
    facts: next.facts,
    inferences: next.inferences,
    gaps: next.gaps,
    candidates: next.needsAnswer?.length ?? 0,
    checkedAt: now.toISOString(),
  };
}

/** The notification to show when a run moves from `prev` to `next`, or null when nothing changed for the user. */
export function transition(prev: InvestigationStatus, next: RunStatus): Notice | null {
  if (prev === next.status) return null;
  switch (next.status) {
    case "paused":
      return {
        title: `${next.subject}: pick the right person`,
        message: `${String(next.needsAnswer?.length ?? 0)} candidates found. Click to choose.`,
      };
    case "done":
      return {
        title: `${next.subject}: profile complete`,
        message: `${String(next.facts)} facts, ${String(next.inferences)} inferences, ${String(next.gaps)} gaps. Click to open.`,
      };
    case "failed":
      return { title: `${next.subject}: research failed`, message: "Click to see the ledger." };
    case "queued":
    case "running":
      return null;
  }
}

export function needsUser(run: TrackedRun): boolean {
  return run.status === "paused" || (run.status === "done" && !run.opened);
}

export function badgeText(runs: readonly TrackedRun[]): string {
  const n = runs.filter(needsUser).length;
  return n === 0 ? "" : String(n);
}
