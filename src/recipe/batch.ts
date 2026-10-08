/**
 * Batch planner for post-lineup collectors: how many paid actor steps may run concurrently under the call budget.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/batch.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/batch.test.ts
 *
 * Key responsibilities:
 * - `isPaid`: a step that runs an Apify actor (REST `rest/*` and `ares/*` collectors are free)
 * - `planBatch`: free steps always run; paid steps only up to the remaining paid calls; at most `size` per batch
 *
 * Design constraints:
 * - Pure; the Workflow loads `remaining` once per batch and defers the rest to the next batch
 * - With no calls left, paid steps still run so each records its own "not searched: run budget reached" gap
 */
import type { Step } from "@/recipe/step";

export function isPaid(step: Step): boolean {
  const actor = step.actor ?? "";
  return actor !== "" && !actor.startsWith("rest/") && !actor.startsWith("ares/");
}

// ponytail: one paid call per paid step; a multi-query step can still overshoot by its extra calls, the runner's
// per-step budget check bounds it. Pass a per-step allowance if that ever matters.
export function planBatch(pending: readonly Step[], remaining: number, size: number): { now: Step[]; later: Step[] } {
  const allowance = remaining > 0 ? remaining : Number.POSITIVE_INFINITY;
  const now: Step[] = [];
  const later: Step[] = [];
  let paid = 0;
  for (const s of pending) {
    const fits = now.length < size && (!isPaid(s) || paid < allowance);
    if (fits && isPaid(s)) paid += 1;
    (fits ? now : later).push(s);
  }
  return { now, later };
}
