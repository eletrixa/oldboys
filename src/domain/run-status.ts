/**
 * RunStatus: the small JSON projection of an investigation that a polling client needs.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/run-status.ts
 * Deps:    zod
 * Tested:  src/domain/__tests__/run-status.test.ts
 *
 * Key responsibilities:
 * - Define the wire schema shared by GET /api/runs/:id and the browser extension (plans/004)
 * - Build it from plain rows (no I/O) so the route stays one query per table
 * - Decide the dedupe window for a repeated mark of the same source URL and goal
 * - Hourly run caps: shared token, public start form, intake funnel default
 *
 * Design constraints:
 * - Relative imports only: this file is also compiled inside extension/ where "@/" means something else
 * - needsAnswer is non-null only while the investigation is paused on a lineup
 */
import { z } from "zod";
import { CandidateDecision, GoalId, InvestigationStatus } from "./claim";

export const LineupCandidate = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  anchor_match: z.string().nullable(),
  score: z.number().min(0).max(1),
  decision: CandidateDecision,
});
export type LineupCandidate = z.infer<typeof LineupCandidate>;

export const RunStatus = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  goal: GoalId,
  status: InvestigationStatus,
  facts: z.number().int().nonnegative(),
  inferences: z.number().int().nonnegative(),
  statements: z.number().int().nonnegative(),
  gaps: z.number().int().nonnegative(),
  needsAnswer: z.array(LineupCandidate).nullable(),
  createdAt: z.string().min(1),
});
export type RunStatus = z.infer<typeof RunStatus>;

export type InvestigationHead = {
  id: string;
  subject: string;
  goal: GoalId;
  status: InvestigationStatus;
  created_at: string;
};

export type ClaimKindCount = { kind: string; n: number };

/** Assemble the projection from the three row sets the route reads. */
export function toRunStatus(
  head: InvestigationHead,
  claimCounts: readonly ClaimKindCount[],
  gaps: number,
  candidates: readonly LineupCandidate[],
): RunStatus {
  const count = (kind: string): number => claimCounts.find((c) => c.kind === kind)?.n ?? 0;
  return RunStatus.parse({
    id: head.id,
    subject: head.subject,
    goal: head.goal,
    status: head.status,
    facts: count("FACT"),
    inferences: count("INFERENCE"),
    statements: count("STATEMENT"),
    gaps,
    needsAnswer: head.status === "paused" ? [...candidates] : null,
    createdAt: head.created_at,
  });
}

/** A mark of the same page with the same goal inside this window reuses the earlier run. */
export const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Earliest created_at (ISO) an earlier run may have to still be reused for a mark made at `now`. */
export function dedupeSince(now: Date): string {
  return new Date(now.getTime() - DEDUPE_WINDOW_MS).toISOString();
}

/** Runs started per hour across the shared token before the API answers 429. */
export const RUNS_PER_HOUR_CAP = 20;
/** Runs started from the public start form (no bearer of its own) in any rolling hour. */
export const START_PER_HOUR_CAP = 6;
/** Runs started by the intake funnel in any rolling hour when var INTAKE_PER_HOUR_CAP is unset (specs/intake). */
export const INTAKE_PER_HOUR_CAP_DEFAULT = 10;
