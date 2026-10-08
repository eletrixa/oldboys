/**
 * planBatch: paid actor steps per batch never exceed the remaining call budget; free REST steps always run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/batch.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { isPaid, planBatch } from "@/recipe/batch";
import type { Step } from "@/recipe/step";

const paid = (id: string): Step => ({ id, kind: "actor", actor: "apify/instagram-profile-scraper" });
const free = (id: string): Step => ({ id, kind: "actor", actor: "rest/github" });
const ids = (xs: readonly Step[]) => xs.map((x) => x.id);

describe("planBatch", () => {
  it("classifies REST and ARES collectors as free, Apify actors and SERP as paid", () => {
    expect([paid("a"), free("b"), { id: "c", kind: "ares", actor: "ares/x" } as Step, { id: "d", kind: "serp", actor: "apify/google-search-scraper" } as Step].map(isPaid)).toEqual([true, false, false, true]);
  });

  it("starts no more paid steps than the budget has left and defers the rest", () => {
    const { now, later } = planBatch([paid("p1"), free("f1"), paid("p2"), paid("p3"), free("f2")], 1, 5);
    expect(ids(now)).toEqual(["p1", "f1", "f2"]);
    expect(ids(later)).toEqual(["p2", "p3"]);
  });

  it("caps the batch size and keeps order", () => {
    const { now, later } = planBatch([free("a"), free("b"), free("c")], 10, 2);
    expect(ids(now)).toEqual(["a", "b"]);
    expect(ids(later)).toEqual(["c"]);
  });

  it("with the budget spent, still runs paid steps so each records its own budget gap (always makes progress)", () => {
    expect(ids(planBatch([paid("p1"), paid("p2")], 0, 5).now)).toEqual(["p1", "p2"]);
  });
});
