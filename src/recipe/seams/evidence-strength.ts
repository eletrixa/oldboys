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
 *   x.com, instagram, tiktok, bsky), and any URL on a merged candidate's own site, profile URL or handle (also the
 *   LinkedIn /posts/<handle>_<slug> form, the handle taken from the /in/<slug> profile URL when none is stored)
 * - Strong: registries (ARES), employer page (linkedin-company), activity records (GitHub, Stack Exchange, OpenAlex,
 *   ORCID, Hugging Face), press and third-party pages, SERP snippets
 * - On a strong source, a singular first-person quote ("I", "jsem", "můj") or a plural one ("we", "jsme", "náš") that
 *   also names the subject is his own words in press: weak, note "self-quoted in press"; plural alone is the company's
 *   voice: strong, note "company statement". Self-authored lines never get a press note.
 *
 * - Never strong: INFERENCE lines (derived, nobody said them) and sources whose identity is not "merged"
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
export const COMPANY_STATEMENT = "company statement";
const SINGULAR = /(?<!\p{L})(i|me|my|já|jsem|můj|moje|mě|mi)(?!\p{L})/iu;
// Czech "my" is "we": a quote with Czech letters or common Czech words reads "my" as plural
// ponytail: stopword heuristic, a short Czech quote without them ("my rosteme") still reads singular; a language check if that bites
const CZECH = /[áčďéěíňóřšťúůýž]|(?<!\p{L})(ale|že|se|je|jsme|jsou|není|také|tak)(?!\p{L})/iu;
const singular = (quote: string): boolean => SINGULAR.test(CZECH.test(quote) ? quote.replace(/(?<!\p{L})my(?!\p{L})/giu, "") : quote);

const SELF_ACTORS: ReadonlySet<string> = new Set([
  ...LINKEDIN_PROFILE_ACTORS, "apify/linkedin-profile-scraper", "harvestapi/linkedin-profile-posts", "apidojo/tweet-scraper",
  "rest/bluesky", "apify/instagram-profile-scraper", "clockworks/tiktok-profile-scraper", CV_ACTOR,
]);
/** Independent records: checked before the own-URL rule, so a merged GitHub profile still counts as an activity record. */
const RECORD_ACTORS: ReadonlySet<string> = new Set(["harvestapi/linkedin-company", "rest/github", "rest/stackexchange", "rest/openalex", "rest/orcid", "rest/huggingface"]);
const SELF_PLATFORMS: ReadonlySet<string> = new Set(["cv", "x", "instagram", "tiktok", "bluesky"]);

type Owner = Pick<Candidate, "profile_urls" | "handle" | "platform" | "name">;

const norm = (u: string): string => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
const host = (u: string): string => norm(u).split(/[/?#]/)[0] ?? "";

/** Handle plus the slug of any linkedin.com/in/<slug> profile URL, lowercased, no "@". */
function handles(c: Owner): string[] {
  const slugs = c.profile_urls.map((p) => /linkedin\.com\/in\/([^/?#]+)/i.exec(p)?.[1]).filter((x) => x !== undefined);
  return [...(c.handle === null || c.platform === "web" ? [] : [c.handle]), ...slugs].map((h) => decodeURIComponent(h).toLowerCase().replace(/^@/, ""));
}

function ownUrl(url: string, candidates: readonly Owner[]): boolean {
  const u = norm(url);
  const segments = u.split(/[/?#]/).slice(1);
  const pulse = segments[0] === "pulse";
  // Post URLs read /posts/<handle>_<slug> or <handle>-<slug>; a Pulse article slug carries the author's handle anywhere
  // ponytail: prefix match, a short handle like "jan" also claims "jan-novak_..."; exact author lookup if that bites
  return candidates.some(
    (c) =>
      c.profile_urls.some((p) => (c.platform === "web" ? host(p) === host(url) : u.startsWith(norm(p)))) ||
      handles(c).some((h) => segments.some((seg) => seg === h || seg.startsWith(`${h}_`) || seg.startsWith(`${h}-`) || (pulse && seg.includes(h)))),
  );
}

function selfSource(source: Pick<Source, "actor" | "url">, candidates: readonly Owner[]): boolean {
  if (SELF_ACTORS.has(source.actor)) return true;
  if (RECORD_ACTORS.has(source.actor) || source.actor.startsWith("ares")) return false;
  const platform = platformOf(source.url);
  if (SELF_PLATFORMS.has(platform) || (platform === "linkedin" && norm(source.url).includes("/in/"))) return true;
  return ownUrl(source.url, candidates);
}

/** True when a word of the quote starts with a name part (3+ letters) of a merged candidate, so Czech cases ("Buryanem") match. */
function namesSubject(quote: string, candidates: readonly Owner[]): boolean {
  const words = quote.toLowerCase().match(/\p{L}+/gu) ?? [];
  const parts = candidates.flatMap((c) => c.name.toLowerCase().match(/\p{L}{3,}/gu) ?? []);
  return words.some((w) => parts.some((p) => w.startsWith(p)));
}

/**
 * Strength of one evidence line; `candidates` are the merged identities (their sites, profiles and handles are self-authored).
 * On an independent source: singular first person, or plural first person next to the subject's name, is his own words in
 * press (weak); plural first person alone is the company speaking (strong, noted).
 */
export function evidenceStrength(
  source: Pick<Source, "actor" | "url" | "identity">,
  quote: string,
  candidates: readonly Owner[],
  kind: ProfileEvidence["kind"] = "FACT",
): { strength: ProfileEvidence["strength"]; note: string } {
  // A derived line nobody said, or a source not tied to the confirmed person, is never independent evidence about them
  if (kind === "INFERENCE" || source.identity !== "merged" || selfSource(source, candidates)) return { strength: "weak", note: "" };
  if (!FIRST_PERSON.test(quote)) return { strength: "strong", note: "" };
  if (singular(quote) || namesSubject(quote, candidates)) return { strength: "weak", note: SELF_QUOTED };
  return { strength: "strong", note: COMPANY_STATEMENT };
}
