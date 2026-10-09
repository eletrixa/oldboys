/**
 * Every registered collector has a plain label on the run page (no raw actor id in "Not searched" lines).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/source-labels.test.ts
 * Deps:    vitest, src/recipe/sources (registeredActorIds), ../source-labels
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - A collector added without a STEP_LABEL entry fails here instead of showing "treg_people_search" to a recruiter
 *
 * Design constraints:
 * - Reads the real registry, so a renamed actor id shows up here
 */
import { describe, expect, it } from "vitest";
import { registeredActorIds } from "@/recipe/sources";
import { STEP_LABEL } from "../source-labels";

describe("STEP_LABEL", () => {
  it("names every registered collector", () => {
    const unlabeled = registeredActorIds().filter((id) => !(id in STEP_LABEL));
    expect(unlabeled).toEqual([]);
  });
});
