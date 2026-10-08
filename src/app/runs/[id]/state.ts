/**
 * Shared types and pure helpers for the run view (state shape, progress rows).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/state.ts
 * Deps:    src/domain/claim (types only)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - RunState: the GET /api/runs/:id/state contract
 * - stepRows: map the ledger step + status to the five human progress rows
 *
 * Design constraints:
 * - Pure and import-type only, so both the route handler and client code can use it
 */
import type { Brief, Candidate, Claim } from "@/domain/claim";

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
};

export type RowState = "done" | "active" | "todo";

/** Index of the human row a ledger step belongs to; unknown steps are treated as collectors. */
function rowOf(step: string): number {
  if (step.startsWith("serp")) return 0;
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
