/**
 * Sliding-window scheduler rule for collector steps: which pending step may start next under the paid-call budget.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/batch.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/batch.test.ts
 *
 * Key responsibilities:
 * - `isPaid`: a step that runs an Apify actor (REST `rest/*`, `ares/*` and `treg/*` collectors never take an Apify slot)
 * - `nextToStart`: first pending step that may start now: window not full; free steps always; paid steps while paid calls
 *   are left, or when no paid step is running
 *
 * Design constraints:
 * - Pure; the Workflow reads the paid allowance once per pool and decrements it per paid start
 * - A blocked paid step never blocks later free steps
 * - With no paid step running, a paid step starts even at allowance 0, so the in-step ledger check sees accurate spend,
 *   the step records its own "not searched: run budget reached" gap, and the run always makes progress
 */
import type { Step } from "@/recipe/step";

export function isPaid(step: Step): boolean {
  const actor = step.actor ?? "";
  // treg spend is USD-gated in the runner and is never an Apify run
  return actor !== "" && !actor.startsWith("rest/") && !actor.startsWith("ares/") && !actor.startsWith("treg/");
}

// ponytail: one paid call per paid step; a multi-query step can still overshoot by its extra calls, the runner's
// per-step budget check bounds it. Pass a per-step allowance if that ever matters.
export function nextToStart(pending: readonly Step[], running: readonly Step[], paidLeft: number, size: number): Step | null {
  if (running.length >= size) return null;
  const paidRunning = running.some(isPaid);
  return pending.find((s) => !isPaid(s) || paidLeft > 0 || !paidRunning) ?? null;
}
