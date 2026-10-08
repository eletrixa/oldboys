/**
 * Recipe registry: look up the declared recipe for a goal id.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/goals/index.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/goals.test.ts
 *
 * Key responsibilities:
 * - Map GoalId -> Recipe; the only place that knows all goals
 *
 * Design constraints:
 * - Exhaustive over GoalId; adding a goal must fail typecheck until it is registered here
 */
import type { GoalId } from "@/domain/claim";
import { dueDiligenceRecipe } from "@/recipe/goals/due-diligence";
import { hiringRecipe } from "@/recipe/goals/hiring";
import type { Recipe } from "@/recipe/step";

const recipes: Record<GoalId, Recipe> = {
  hiring: hiringRecipe,
  "due-diligence": dueDiligenceRecipe,
};

export function recipeFor(goal: GoalId): Recipe {
  return recipes[goal];
}
