/**
 * Recipe value objects: Question, Step, Recipe.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/step.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/goals.test.ts
 *
 * Key responsibilities:
 * - Shape of a declared per-goal recipe: ordered steps with onEmpty fallbacks and one pausable resolve step
 *
 * Design constraints:
 * - Branching happens only via `onEmpty` and the `resolve` step (plans/001 pre-mortem #1)
 * - A step file over 150 lines is a planner in disguise; cut it or move logic to a `replan` step
 */
import type { GoalId } from "@/domain/claim";

export type Question = { id: string; text: string };

export type StepKind = "serp" | "actor" | "ares" | "resolve" | "extract" | "verify" | "synthesize";

export type Step = {
  id: string;
  kind: StepKind;
  /** Apify actor id, REST source id (ares/..., rest/...); absent for LLM seams and resolve. */
  actor?: string;
  /** Search query template for serp steps; `{subject}` and `{anchor}` are substituted. */
  query?: string;
  /** What to do when the step returns nothing: run another step id, or record a Gap. */
  onEmpty?: { fallbackStep: string } | { gap: string };
};

export type Recipe = {
  goal: GoalId;
  questions: readonly Question[];
  steps: readonly Step[];
};
