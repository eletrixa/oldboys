/**
 * Tests for the position's registry plan: everyone set always, role set by title, manual set listed separately.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/__tests__/registry-checks.test.ts
 * Deps:    vitest, ../registry-checks
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - A backend engineer gets only the everyone registries; a doctor gets NRPZS (fetch) and the Medical Chamber (manual)
 *
 * Design constraints:
 * - Pure
 */
import { describe, expect, it } from "vitest";
import { registryPlan } from "../registry-checks";

describe("registryPlan", () => {
  it("splits everyone, role and manual registries by the title", () => {
    const eng = registryPlan("Backend Engineer");
    expect(eng.everyone.map((r) => r.id)).toEqual(["isir", "ares", "justice-or", "police"]);
    expect(eng.role).toEqual([]);
    expect(eng.manual).toEqual([]);
    const doc = registryPlan("Lékař internista");
    expect(doc.role.map((r) => r.id)).toEqual(["nrpzs"]);
    expect(doc.manual.map((r) => r.id)).toEqual(["clk"]);
  });
});
