/**
 * Goal-divergence tests: the two recipes must differ in substance, not just headings.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/goals.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Shared step ids are fewer than 50% of either recipe's steps
 * - Only hiring calls github; only due-diligence calls ares_vr
 * - Each recipe has exactly one resolve step and unique step ids
 *
 * Design constraints:
 * - Guards plans/001 risk #2 (cosmetic goal switch); do not loosen the threshold
 */
import { describe, expect, it } from "vitest";
import { dueDiligenceRecipe } from "@/recipe/goals/due-diligence";
import { hiringRecipe } from "@/recipe/goals/hiring";
import { recipeFor } from "@/recipe/goals";

const ids = (steps: readonly { id: string }[]) => steps.map((s) => s.id);

describe("goal recipes diverge", () => {
  it("share fewer than 50% of step ids, measured against the shorter recipe", () => {
    const hiring = new Set(ids(hiringRecipe.steps));
    const dd = new Set(ids(dueDiligenceRecipe.steps));
    const shared = [...hiring].filter((id) => dd.has(id));
    const ratio = shared.length / Math.min(hiring.size, dd.size);
    expect(ratio).toBeLessThan(0.5);
  });

  it("only hiring calls github_profile; only due-diligence calls ares_vr", () => {
    expect(ids(hiringRecipe.steps)).toContain("github_profile");
    expect(ids(dueDiligenceRecipe.steps)).not.toContain("github_profile");
    expect(ids(dueDiligenceRecipe.steps)).toContain("ares_vr");
    expect(ids(hiringRecipe.steps)).not.toContain("ares_vr");
    expect(hiringRecipe.steps.some((s) => s.kind === "ares")).toBe(false);
  });

  it("each recipe has unique step ids and exactly one resolve step", () => {
    for (const recipe of [hiringRecipe, dueDiligenceRecipe]) {
      const all = ids(recipe.steps);
      expect(new Set(all).size).toBe(all.length);
      expect(recipe.steps.filter((s) => s.kind === "resolve")).toHaveLength(1);
    }
  });

  it("onEmpty fallbacks point at existing step ids", () => {
    for (const recipe of [hiringRecipe, dueDiligenceRecipe]) {
      const all = new Set(ids(recipe.steps));
      for (const step of recipe.steps) {
        if (step.onEmpty && "fallbackStep" in step.onEmpty) {
          expect(all.has(step.onEmpty.fallbackStep)).toBe(true);
        }
      }
    }
  });

  it("question lists differ by more than half", () => {
    const h = new Set(hiringRecipe.questions.map((q) => q.id));
    const shared = dueDiligenceRecipe.questions.filter((q) => h.has(q.id)).length;
    expect(shared / Math.min(h.size, dueDiligenceRecipe.questions.length)).toBeLessThan(0.5);
  });

  it("recipeFor resolves both goals", () => {
    expect(recipeFor("hiring")).toBe(hiringRecipe);
    expect(recipeFor("due-diligence")).toBe(dueDiligenceRecipe);
  });
});
