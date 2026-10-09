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
 * - `github_deep` (and the code-contributions question) is hiring-only and directly follows `github_profile`
 * - Each recipe has exactly one resolve step and unique step ids
 * - Hiring asks one question per brief section, each with a fixed title, within the paid actor run cap
 *
 * Design constraints:
 * - Guards plans/001 risk #2 (cosmetic goal switch); do not loosen the threshold
 */
import { describe, expect, it } from "vitest";
import { dueDiligenceRecipe } from "@/recipe/goals/due-diligence";
import { hiringRecipe } from "@/recipe/goals/hiring";
import { recipeFor } from "@/recipe/goals";
import { sectionTitle } from "@/recipe/seams/sections";
import { isPaid } from "@/recipe/batch";
import { collectorFor } from "@/recipe/sources";

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

  it("github_deep and code-contributions are hiring-only; github_deep directly follows github_profile", () => {
    const h = ids(hiringRecipe.steps);
    expect(h).toContain("github_deep");
    expect(h.indexOf("github_deep")).toBe(h.indexOf("github_profile") + 1);
    expect(ids(dueDiligenceRecipe.steps)).not.toContain("github_deep");
    expect(ids(hiringRecipe.questions)).toContain("code-contributions");
    expect(ids(dueDiligenceRecipe.questions)).not.toContain("code-contributions");
  });

  it("github_apify directly follows github_deep and is absent from due-diligence", () => {
    const h = ids(hiringRecipe.steps);
    expect(h.indexOf("github_apify")).toBe(h.indexOf("github_deep") + 1);
    expect(ids(dueDiligenceRecipe.steps)).not.toContain("github_apify");
  });

  it("each recipe has unique step ids and exactly one resolve step", () => {
    for (const recipe of [hiringRecipe, dueDiligenceRecipe]) {
      const all = ids(recipe.steps);
      expect(new Set(all).size).toBe(all.length);
      expect(recipe.steps.filter((s) => s.kind === "resolve")).toHaveLength(1);
    }
  });

  it("every step with an actor resolves to a registered collector", () => {
    for (const recipe of [hiringRecipe, dueDiligenceRecipe]) {
      for (const step of recipe.steps) {
        if (step.actor !== undefined) expect(collectorFor(step.actor).id).toBe(step.actor);
      }
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

  it("hiring asks one question per brief section, each with a short fixed title", () => {
    const want = ["current-role", "employer-context", "career-history", "education", "public-code", "code-contributions", "public-talks", "writing", "press", "social-presence", "community", "location-match", "regulatory-filings", "legal-record", "public-registries", "contradictions"];
    expect(hiringRecipe.questions.map((q) => q.id)).toEqual(want);
    const titles = hiringRecipe.questions.map((q) => sectionTitle({ id: q.id, text: "x" }));
    expect(titles.every((t) => t !== "x")).toBe(true);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("hiring stays within the 24 paid actor runs per run (seed scrape included)", () => {
    const paid = hiringRecipe.steps.filter(isPaid); // treg/* steps are USD-only reads, never an Apify run
    expect(paid.length + 1).toBeLessThanOrEqual(24);
  });

  it("recipeFor resolves both goals", () => {
    expect(recipeFor("hiring")).toBe(hiringRecipe);
    expect(recipeFor("due-diligence")).toBe(dueDiligenceRecipe);
  });
});
