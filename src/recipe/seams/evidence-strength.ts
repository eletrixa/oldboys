/**
 * Evidence strength: "weak" when the person wrote the line themselves, "strong" when an independent party published it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/evidence-strength.ts
 * Deps:    src/domain/claim, src/domain/cv-check (CV_ACTOR), src/recipe/sources/linkedin, src/recipe/sources/types
 * Tested:  src/recipe/__tests__/evidence-strength.test.ts
 *
 * Key responsibilities:
 * - Weak: own LinkedIn profile or posts, X, Bluesky, Instagram, TikTok, the CV, a personal-profile URL (linkedin.com/in,
 *   x.com, instagram, tiktok, bsky), and any URL on a merged candidate's own site, profile URL or handle
 * - Strong: registries (ARES), employer page (linkedin-company), activity records (GitHub, Stack Exchange, OpenAlex,
 *   ORCID, Hugging Face), press and third-party pages, SERP snippets
 * - A strong source whose quote is first person ("I", "we", "jsem", "náš") is the person's own words in press: weak,
 *   note "self-quoted in press"
 *
 * Design constraints:
 * - Pure; set in code, never by the model
 */
import type { Candidate, ProfileEvidence, Source } from "@/domain/claim";
import { CV_ACTOR } from "@/domain/cv-check";
import { LINKEDIN_PROFILE_ACTORS } from "@/recipe/sources/linkedin";
import { platformOf } from "@/recipe/sources/types";

// ponytail: pronoun list (English + Czech); a third-person quote with "we" in it still passes, a model check if that bites
export const FIRST_PERSON = /(?<!\p{L})(i|me|my|we|our|us|já|jsem|jsme|můj|moje|náš|naše|nám|nás)(?!\p{L})/iu;
export const SELF_QUOTED = "self-quoted in press";

const SELF_ACTORS: ReadonlySet<string> = new Set([
  ...LINKEDIN_PROFILE_ACTORS, "apify/linkedin-profile-scraper", "harvestapi/linkedin-profile-posts", "apidojo/tweet-scraper",
  "rest/bluesky", "apify/instagram-profile-scraper", "clockworks/tiktok-profile-scraper", CV_ACTOR,
]);
/** Independent records: checked before the own-URL rule, so a merged GitHub profile still counts as an activity record. */
const RECORD_ACTORS: ReadonlySet<string> = new Set(["harvestapi/linkedin-company", "rest/github", "rest/stackexchange", "rest/openalex", "rest/orcid", "rest/huggingface"]);
const SELF_PLATFORMS: ReadonlySet<string> = new Set(["cv", "x", "instagram", "tiktok", "bluesky"]);

type Owner = Pick<Candidate, "profile_urls" | "handle" | "platform">;

const norm = (u: string): string => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
const host = (u: string): string => norm(u).split(/[/?#]/)[0] ?? "";

function ownUrl(url: string, candidates: readonly Owner[]): boolean {
  const u = norm(url);
  const segments = u.split(/[/?#]/).slice(1);
  return candidates.some(
    (c) =>
      c.profile_urls.some((p) => (c.platform === "web" ? host(p) === host(url) : u.startsWith(norm(p)))) ||
      (c.handle !== null && c.platform !== "web" && segments.includes(c.handle.toLowerCase().replace(/^@/, ""))),
  );
}

function selfSource(source: Pick<Source, "actor" | "url">, candidates: readonly Owner[]): boolean {
  if (SELF_ACTORS.has(source.actor)) return true;
  if (RECORD_ACTORS.has(source.actor) || source.actor.startsWith("ares")) return false;
  const platform = platformOf(source.url);
  if (SELF_PLATFORMS.has(platform) || (platform === "linkedin" && norm(source.url).includes("/in/"))) return true;
  return ownUrl(source.url, candidates);
}

/** Strength of one evidence line; `candidates` are the merged identities (their sites, profiles and handles are self-authored). */
export function evidenceStrength(
  source: Pick<Source, "actor" | "url">,
  quote: string,
  candidates: readonly Owner[],
): { strength: ProfileEvidence["strength"]; note: string } {
  if (selfSource(source, candidates)) return { strength: "weak", note: "" };
  return FIRST_PERSON.test(quote) ? { strength: "weak", note: SELF_QUOTED } : { strength: "strong", note: "" };
}
