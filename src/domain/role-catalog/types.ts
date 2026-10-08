/**
 * Role catalog value types: one preselected company role with its must-haves and its evidence plan.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog/types.ts
 * Deps:    src/domain/position (Family, MustHave)
 * Tested:  src/domain/__tests__/role-catalog.test.ts (through the catalog)
 *
 * Key responsibilities:
 * - `RoleTemplate`: canonical title, family, EN/CZ aliases, evidence profile, 3-5 must-haves, and the
 *   evidence plan (`sources.steps` = hiring recipe step ids in priority order, `sources.sites` = domains for a site: search)
 *
 * Design constraints:
 * - Relative imports only: `scripts/role-catalog-sql.ts` loads the catalog with plain Node, no path alias
 * - Must-haves are observable from public web evidence; never health, politics, religion, ethnicity, sexuality,
 *   personality or trustworthiness (GDPR Art. 9, brief hard rules)
 */
import type { Family, MustHave } from "../position";

export type RoleProfileId = "makers" | "audience" | "credentialed" | "track-record" | "verify-only";

/** Hiring recipe collector step ids a template may prioritise (src/recipe/goals/hiring.ts). */
export const HIRING_EVIDENCE_STEPS = [
  "linkedin_profile",
  "github_profile",
  "stackexchange_profile",
  "huggingface_profile",
  "orcid_search",
  "openalex_author",
  "x_profile",
  "instagram_profile",
  "tiktok_profile",
  "youtube_channel",
  "bluesky_profile",
  "personal_site_crawl",
  "talks_serp",
] as const;
export type HiringEvidenceStep = (typeof HIRING_EVIDENCE_STEPS)[number];

export type RoleTemplate = {
  /** Unique kebab-case key, e.g. "backend-engineer". */
  key: string;
  /** Canonical English title as shown in the start form datalist. */
  title: string;
  family: Family;
  /** Lower-case title variants, English and Czech, abbreviations included; never the canonical title itself. */
  aliases: string[];
  profile: RoleProfileId;
  /** 3 to 5 observable criteria; ids start with "mh-". */
  must_haves: MustHave[];
  sources: {
    /** Collector steps in priority order (3 to 6). */
    steps: HiringEvidenceStep[];
    /** Domains where this role's public work lives (2 to 5), used as a `site:` search; no scheme, no path. */
    sites: string[];
  };
};
