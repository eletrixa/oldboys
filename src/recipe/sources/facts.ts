/**
 * Shared helpers of the collectors' ProfileFacts digests (plans/012).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/facts.ts
 * Deps:    zod, src/domain/profile-facts, ./types (Fetched)
 * Tested:  src/recipe/__tests__/profile-facts-digest.test.ts
 *
 * Key responsibilities:
 * - `parsedAll`: every fetched payload that parses with the schema (pass `z.array(Item)` for list payloads, then `.flat()`)
 * - `dedupeBy`: first item per key wins, empty keys dropped (one account per handle across waves)
 * - `digestOf`: facts list, or null when empty so the ledger ref stays small (the runner skips a null digest)
 *
 * Design constraints:
 * - Pure, no I/O
 */
import type { z } from "zod";
import type { ProfileFacts } from "@/domain/profile-facts";
import type { Fetched } from "@/recipe/sources/types";

export function parsedAll<T>(schema: z.ZodType<T>, fetched: readonly Fetched[]): T[] {
  return fetched.flatMap((f) => {
    const r = schema.safeParse(f.payload);
    return r.success ? [r.data] : [];
  });
}

export function dedupeBy<T>(items: readonly T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => {
    const k = key(t);
    if (k === "" || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function digestOf(facts: readonly ProfileFacts[]): readonly ProfileFacts[] | null {
  return facts.length === 0 ? null : facts;
}
