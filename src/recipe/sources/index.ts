/**
 * Collector registry: Step.actor -> Collector. The only place that knows every source.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/index.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/sources.test.ts
 *
 * Key responsibilities:
 * - Register collectors; `collectorFor(actorId)` throws on an unknown id so a typo fails loudly in tests
 *
 * Design constraints:
 * - Every recipe step with an `actor` must resolve here (asserted in goals.test.ts)
 */
import { aresSearch, aresVr } from "@/recipe/sources/ares";
import { googleSearch } from "@/recipe/sources/google-search";
import type { Collector } from "@/recipe/sources/types";

const all: readonly Collector[] = [googleSearch, aresSearch, aresVr];

const byId = new Map(all.map((c) => [c.id, c]));

export function collectorFor(actorId: string): Collector {
  const c = byId.get(actorId);
  if (!c) throw new Error(`no collector registered for actor "${actorId}"`);
  return c;
}

export function registeredActorIds(): readonly string[] {
  return [...byId.keys()];
}
