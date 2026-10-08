/**
 * Collector registry: Step.actor -> Collector. The only place that knows every source.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/index.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/goals.test.ts (every recipe actor resolves)
 *
 * Key responsibilities:
 * - Register collectors; `collectorFor(actorId)` throws on an unknown id so a typo fails loudly in tests
 *
 * Design constraints:
 * - Every recipe step with an `actor` must resolve here (asserted in goals.test.ts)
 */
import { aresSearch, aresVr } from "@/recipe/sources/ares";
import { bluesky } from "@/recipe/sources/bluesky";
import { github } from "@/recipe/sources/github";
import { googleSearch } from "@/recipe/sources/google-search";
import { huggingface } from "@/recipe/sources/huggingface";
import { instagram } from "@/recipe/sources/instagram";
import { linkedinProfile, linkedinProfileDetail } from "@/recipe/sources/linkedin";
import { linkedinCompany } from "@/recipe/sources/linkedin-company";
import { openalex } from "@/recipe/sources/openalex";
import { orcid } from "@/recipe/sources/orcid";
import { stackexchange } from "@/recipe/sources/stackexchange";
import { tiktok } from "@/recipe/sources/tiktok";
import type { Collector } from "@/recipe/sources/types";
import { websiteCrawler } from "@/recipe/sources/website";
import { x } from "@/recipe/sources/x";
import { youtube } from "@/recipe/sources/youtube";

const all: readonly Collector[] = [
  googleSearch,
  aresSearch,
  aresVr,
  github,
  stackexchange,
  huggingface,
  orcid,
  openalex,
  youtube,
  bluesky,
  x,
  instagram,
  tiktok,
  websiteCrawler,
  linkedinProfile,
  linkedinProfileDetail,
  linkedinCompany,
];

const byId = new Map(all.map((c) => [c.id, c]));

export function collectorFor(actorId: string): Collector {
  const c = byId.get(actorId);
  if (!c) throw new Error(`no collector registered for actor "${actorId}"`);
  return c;
}

export function registeredActorIds(): readonly string[] {
  return [...byId.keys()];
}
