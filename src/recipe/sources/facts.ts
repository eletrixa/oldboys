/**
 * Shared helpers of the collectors' ProfileFacts digests (plans/012).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/facts.ts
 * Deps:    src/domain/profile-facts
 * Tested:  src/recipe/__tests__/profile-facts-digest.test.ts
 *
 * Key responsibilities:
 * - `count`: a platform number as the non-negative integer ProfileFacts wants, else null
 * - `digestOf`: facts list, or null when empty so the ledger ref stays small (the runner skips a null digest)
 *
 * Design constraints:
 * - Pure, no I/O
 */
import type { ProfileFacts } from "@/domain/profile-facts";

export function count(n: number | null | undefined): number | null {
  return n === null || n === undefined || !Number.isFinite(n) || n < 0 ? null : Math.trunc(n);
}

export function digestOf(facts: readonly ProfileFacts[]): ProfileFacts[] | null {
  return facts.length === 0 ? null : [...facts];
}
