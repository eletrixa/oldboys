/**
 * Shared types and pure helpers for the run view (state shape, progress rows).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/state.ts
 * Deps:    src/domain/claim, src/domain/run-cost (types only)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - RunState: the GET /api/runs/:id/state contract
 * - stepRows: map the ledger step + status to the five human progress rows
 * - sortLineup: confirmed first, social platforms before web hits
 *
 * Design constraints:
 * - Pure and import-type only, so both the route handler and client code can use it
 */
import type { Brief, Candidate, Claim } from "@/domain/claim";
import type { RunCost } from "@/domain/run-cost";

export type RunStatus = "queued" | "running" | "paused" | "done" | "failed";

export type RunState = {
  id: string;
  subject: string;
  status: RunStatus;
  step: string | null;
  mentions: number;
  candidates: Candidate[];
  claims: Claim[];
  sources: { id: string; url: string }[];
  questions: { id: string; text: string }[];
  brief: Brief | null;
  /** Reason recorded by the Workflow when status is failed; null otherwise. */
  failure: string | null;
  cost: RunCost;
};

export type RowState = "done" | "active" | "todo";

const PLATFORM_RANK: Record<string, number> = { linkedin: 0, github: 1, x: 2, instagram: 3, tiktok: 4, youtube: 5, bluesky: 6 };
const DECISION_RANK: Record<Candidate["decision"], number> = { merge: 0, "possibly-same-as": 1, rejected: 2 };

/** Lineup order: confirmed first, then open questions, social platforms before plain web hits. */
export function sortLineup<T extends Pick<Candidate, "platform" | "decision" | "score">>(candidates: readonly T[], decisionOf: (c: T) => Candidate["decision"]): T[] {
  return [...candidates].sort(
    (a, b) =>
      DECISION_RANK[decisionOf(a)] - DECISION_RANK[decisionOf(b)] ||
      (PLATFORM_RANK[a.platform] ?? 9) - (PLATFORM_RANK[b.platform] ?? 9) ||
      b.score - a.score,
  );
}

/** Index of the human row a ledger step belongs to; unknown steps are treated as collectors. */
function rowOf(step: string): number {
  if (step.startsWith("serp") || step.startsWith("load") || step.startsWith("role") || step.startsWith("social")) return 0;
  if (step.startsWith("resolve")) return 1;
  if (step.startsWith("extract") || step.startsWith("verify")) return 3;
  if (step.startsWith("synthesize")) return 4;
  return 2;
}

export function stepRows(state: Pick<RunState, "status" | "step" | "mentions">): RowState[] {
  if (state.status === "done") return Array.from({ length: 5 }, () => "done");
  let current = state.step === null ? 0 : rowOf(state.step);
  if (current === 0 && state.mentions > 0) current = 1;
  return Array.from({ length: 5 }, (_, i) => (i < current ? "done" : i === current ? "active" : "todo"));
}
