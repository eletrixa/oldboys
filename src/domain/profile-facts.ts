/**
 * Profile facts: what a collector read about one confirmed public account (plans/012), each with the URL it came from.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/profile-facts.ts
 * Deps:    zod, src/domain/ledger-digest (readDigests)
 * Tested:  src/domain/__tests__/profile-facts.test.ts
 *
 * Key responsibilities:
 * - `ProfileFacts`: Zod schema of one account's public numbers and flags (creation date, followers, following, posts,
 *   connections, verified badge, bio, photo URL, earliest listed experience year); every field nullable because each
 *   platform publishes a different subset
 * - A platform step's ledger ref carries `digest: ProfileFacts[]` (Collector.digest, the github_deep pattern; the seed
 *   step writes the same shape for the manager's LinkedIn profile); `readProfileFacts` reads every row back defensively
 *   (a digest that is not a ProfileFacts array, e.g. github_deep's CodeProfile, is ignored; newest row per step wins;
 *   malformed rows skipped; ledger order; runs before this feature give [])
 * - `facts` builds one ProfileFacts (every field present), `count` normalises a platform number, `PLATFORM_LABEL` and
 *   `FACT_PLATFORMS` name the platforms for the report
 * - `experienceYear`: earliest four-digit start year in LinkedIn experience lines ("Title @ Company (2012–2015)")
 *
 * Design constraints:
 * - Pure, no I/O; facts describe an account, never the person; only accounts of merged candidates are ever recorded
 *   (collectors gate with identityFor === "merged"), so a namesake's numbers can never land here
 * - No D1 schema change: the record lives in the append-only ledger ref, read by the run state route
 */
import { z } from "zod";
import { type LedgerRow, readDigests } from "./ledger-digest";

export const ProfileFacts = z.object({
  /** linkedin, x, instagram, tiktok, github, youtube, bluesky (platformOf vocabulary) */
  platform: z.string().min(1),
  url: z.string().min(1),
  handle: z.string().nullable(),
  display_name: z.string().nullable(),
  /** ISO date or the platform's own string ("2025-08-14T10:00:00.000Z", "Sat Aug 14 2025"); parsed leniently by the rules. */
  created_at: z.string().nullable(),
  followers: z.number().int().nonnegative().nullable(),
  following: z.number().int().nonnegative().nullable(),
  posts: z.number().int().nonnegative().nullable(),
  /** LinkedIn connections count (harvestapi `connectionsCount`). */
  connections: z.number().int().nonnegative().nullable(),
  /** Platform verification badge (LinkedIn `verified`, Instagram `verified`); null when the payload does not say. */
  verified: z.boolean().nullable(),
  premium: z.boolean().nullable(),
  open_to_work: z.boolean().nullable(),
  /** Bio / headline / description text, clipped to BIO_MAX. */
  bio: z.string().nullable(),
  photo_url: z.string().nullable(),
  /** Earliest start year among the LinkedIn experience entries; null elsewhere. */
  earliest_experience_year: z.number().int().nullable(),
  /** The payload URL (actor dataset or REST URL) or the profile URL the numbers were read from. */
  source_url: z.string().min(1),
});
export type ProfileFacts = z.infer<typeof ProfileFacts>;

export const BIO_MAX = 300;

/** Display names of the platforms (platformOf vocabulary). */
export const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  bluesky: "Bluesky",
  facebook: "Facebook",
};

/** Platforms whose collectors record ProfileFacts; a merged candidate there without facts is reported as not checked. */
export const FACT_PLATFORMS: readonly string[] = ["linkedin", "x", "instagram", "tiktok", "github", "youtube", "bluesky", "facebook"];

/** A ProfileFacts with every field present: `over` sets what the collector read, `source_url` defaults to `url`. */
export function facts(platform: string, url: string, over: Partial<ProfileFacts> = {}): ProfileFacts {
  return {
    platform,
    url,
    handle: null,
    display_name: null,
    created_at: null,
    followers: null,
    following: null,
    posts: null,
    connections: null,
    verified: null,
    premium: null,
    open_to_work: null,
    bio: null,
    photo_url: null,
    earliest_experience_year: null,
    source_url: url,
    ...over,
  };
}

/** A platform number as the non-negative integer ProfileFacts wants, else null. */
export function count(n: number | null | undefined): number | null {
  return n === null || n === undefined || !Number.isFinite(n) || n < 0 ? null : Math.trunc(n);
}

export function clipBio(text: string | null | undefined): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t === "") return null;
  return t.length <= BIO_MAX ? t : `${t.slice(0, BIO_MAX - 1)}…`;
}

/** A harvestapi date as text: a string, a number, or an object with `text` / `year` (the actor's date shape). */
function dateText(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    return [o.text, o.year, o.linkedinText].map(dateText).find((t) => t !== "") ?? "";
  }
  return "";
}

/** Earliest four-digit year (1950..2099) among start dates (strings, numbers or harvestapi `{ text }` objects); null when none parses. */
export function experienceYear(starts: readonly unknown[]): number | null {
  let min: number | null = null;
  for (const s of starts) {
    const m = /(?:19[5-9]\d|20\d\d)/.exec(dateText(s));

    if (m === null) continue;
    const y = Number(m[0]);
    if (min === null || y < min) min = y;
  }
  return min;
}

/** Every step's newest `ref.digest` that is a ProfileFacts array, in ledger order (recipe order, the seed step first). */
export function readProfileFacts(rows: readonly LedgerRow[]): ProfileFacts[] {
  return [...readDigests(rows, z.array(ProfileFacts)).values()].flat();
}
