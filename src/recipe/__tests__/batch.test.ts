/**
 * nextToStart: the sliding-window rule. Free steps always start, paid steps only while paid calls are left or none runs.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/batch.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { isPaid, nextToStart } from "@/recipe/batch";
import type { Step } from "@/recipe/step";

const paid = (id: string): Step => ({ id, kind: "actor", actor: "apify/instagram-profile-scraper" });
const free = (id: string): Step => ({ id, kind: "actor", actor: "rest/github" });
const idOf = (s: Step | null) => s?.id ?? null;

describe("nextToStart", () => {
  it("classifies REST and ARES collectors as free, Apify actors and SERP as paid", () => {
    expect([paid("a"), free("b"), { id: "c", kind: "ares", actor: "ares/x" } as Step, { id: "d", kind: "serp", actor: "apify/google-search-scraper" } as Step].map(isPaid)).toEqual([true, false, false, true]);
  });

  it("returns null when the window is full", () => {
    expect(nextToStart([free("a")], [free("r1"), free("r2")], 5, 2)).toBeNull();
  });

  it("returns null when nothing is pending", () => {
    expect(nextToStart([], [], 5, 2)).toBeNull();
  });

  it("always starts a free step, even with no paid calls left and a paid step running", () => {
    expect(idOf(nextToStart([free("f1")], [paid("r")], 0, 6))).toBe("f1");
  });

  it("starts a paid step while paid calls are left", () => {
    expect(idOf(nextToStart([paid("p1")], [paid("r")], 1, 6))).toBe("p1");
  });

  it("blocks a paid step while a paid one runs and nothing is left, without blocking later free steps", () => {
    expect(nextToStart([paid("p1")], [paid("r")], 0, 6)).toBeNull();
    expect(idOf(nextToStart([paid("p1"), free("f1")], [paid("r")], 0, 6))).toBe("f1");
  });

  it("starts a paid step when no paid step runs, even with paidLeft 0 (always makes progress)", () => {
    expect(idOf(nextToStart([paid("p1")], [free("r")], 0, 6))).toBe("p1");
    expect(idOf(nextToStart([paid("p1")], [], 0, 6))).toBe("p1");
  });

  it("keeps pending order: the first step that may start wins", () => {
    expect(idOf(nextToStart([paid("p1"), free("f1"), paid("p2")], [], 2, 6))).toBe("p1");
    expect(idOf(nextToStart([free("f1"), paid("p1")], [], 2, 6))).toBe("f1");
  });
});
