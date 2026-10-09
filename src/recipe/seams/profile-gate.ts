/**
 * Profile gate: the code-side checks every profile evidence line passes (quote in excerpt, strength from the source),
 * the source ranking and the prompt source block, shared by the profile and personality seams.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/profile-gate.ts
 * Deps:    src/domain/claim (types), src/domain/quote (quoteInExcerpt), ./evidence-strength, src/domain/cv-check (CV_ACTOR), ../sources/linkedin (LINKEDIN_PROFILE_ACTORS), ../sources/personal-site (PERSONAL_SITE_ACTOR)
 * Tested:  src/recipe/__tests__/profile.test.ts (validEvidence, rankSources)
 *
 * Key responsibilities:
 * - validEvidence: unknown source id or quote not in the excerpt drops the line; `strength` set in code, never by the model
 * - rankSources: profile and CV first, then own posts and own website, then press and talks, then the rest
 * - sourceBlock: `[id] url` + excerpt per source up to `maxChars` (default PROMPT_CHARS), then the verified claims
 *
 * Design constraints:
 * - Pure; no I/O
 */
import type { Candidate, Claim, ProfileEvidence, Source } from "@/domain/claim";
import { quoteInExcerpt } from "@/domain/quote";
import { evidenceStrength } from "@/recipe/seams/evidence-strength";
import { CV_ACTOR } from "@/domain/cv-check";
import { LINKEDIN_PROFILE_ACTORS } from "@/recipe/sources/linkedin";
import { PERSONAL_SITE_ACTOR } from "@/recipe/sources/personal-site";

export const PROMPT_CHARS = 60_000;
const POST_ACTORS = new Set(["harvestapi/linkedin-profile-posts", "apidojo/tweet-scraper", "rest/bluesky", PERSONAL_SITE_ACTOR]);
const PRESS_ACTORS = new Set(["apify/google-search-scraper", "apify/website-content-crawler"]);
/** Sources the subject wrote: own LinkedIn profile, CV, own posts, own website (reposts are unverified, so never confirmed). */
export const OWN_WRITING = new Set([...LINKEDIN_PROFILE_ACTORS, CV_ACTOR, ...POST_ACTORS]);

/** Keeps evidence whose quote is inside the excerpt of the source it names (unknown ids fail); sets `strength` in code, never from the model. */
export function validEvidence(
  evidence: readonly ProfileEvidence[],
  sources: readonly Pick<Source, "id" | "excerpt" | "actor" | "url" | "identity">[],
  candidates: readonly Pick<Candidate, "profile_urls" | "handle" | "platform" | "name">[] = [],
): ProfileEvidence[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return evidence.flatMap((e) => {
    const s = byId.get(e.source_id);
    if (s === undefined || !quoteInExcerpt(e.quote, s.excerpt)) return [];
    const { strength, note } = evidenceStrength(s, e.quote, candidates, e.kind);
    const supports = e.direction === undefined ? e.supports : e.direction !== "contradicts";
    return [note === "" ? { ...e, supports, strength } : { ...e, supports, strength, note: e.note ? `${e.note}, ${note}` : note }];
  });
}

/** Profile and CV first, then own posts, then press and talks, then the rest; stable within a tier. */
export function rankSources(sources: readonly Source[]): Source[] {
  const tier = (s: Source): number => (LINKEDIN_PROFILE_ACTORS.has(s.actor) || s.actor === CV_ACTOR ? 0 : POST_ACTORS.has(s.actor) ? 1 : PRESS_ACTORS.has(s.actor) ? 2 : 3);
  return [...sources].sort((a, b) => tier(a) - tier(b));
}

/** Sources in the given order until `maxChars`, then the verified claims. */
export function sourceBlock(sources: readonly Source[], claims: readonly Claim[], maxChars = PROMPT_CHARS): string {
  let body = "";
  for (const s of sources) {
    const line = `[${s.id}] ${s.url}\n${s.excerpt}\n\n`;
    if (body.length + line.length > maxChars) break;
    body += line;
  }
  return `Sources:\n${body}\nVerified claims:\n${claims.map((c) => `- [${c.kind}] ${c.text}`).join("\n") || "- (none)"}`;
}
