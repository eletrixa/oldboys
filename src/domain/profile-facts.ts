/**
 * Profile facts: what a collector read about one confirmed public account (plans/012), each with the URL it came from.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/profile-facts.ts
 * Deps:    zod
 * Tested:  src/domain/__tests__/profile-facts.test.ts
 *
 * Key responsibilities:
 * - `ProfileFacts`: Zod schema of one account's public numbers and flags (creation date, followers, following, posts,
 *   connections, verified badge, bio, photo URL, earliest listed experience year); every field nullable because each
 *   platform publishes a different subset
 * - A platform step's ledger ref carries `digest: ProfileFacts[]` (Collector.digest, the github_deep pattern; the seed
 *   step writes the same shape for the manager's LinkedIn profile); `readProfileFacts` reads every row back defensively
 *   (a digest that is not a ProfileFacts array, e.g. github_deep's CodeProfile, is ignored; newest row per step wins;
 *   malformed rows skipped; runs before this feature give [])
 * - `experienceYear`: earliest four-digit start year in LinkedIn experience lines ("Title @ Company (2012–2015)")
 *
 * Design constraints:
 * - Pure, no I/O; facts describe an account, never the person; only accounts of merged candidates are ever recorded
 *   (collectors gate with identityFor === "merged"), so a namesake's numbers can never land here
 * - No D1 schema change: the record lives in the append-only ledger ref, read by the run state route
 */
import { z } from "zod";

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

export const FACTS_REF_KEY = "digest";
export const BIO_MAX = 300;

/** Display order of platforms (the seed step writes the manager's LinkedIn profile first); other steps follow. */
export const FACTS_STEPS: readonly string[] = ["seed_profile", "linkedin_profile", "x_profile", "instagram_profile", "tiktok_profile", "github_profile", "youtube_channel", "bluesky_profile"];

type LedgerRow = { step?: string | null; ref_json?: string | null };

/** A ProfileFacts with every optional field present (collectors fill what they have). */
export function emptyFacts(platform: string, url: string, sourceUrl: string): ProfileFacts {
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
    source_url: sourceUrl,
  };
}

export function clipBio(text: string | null | undefined): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t === "") return null;
  return t.length <= BIO_MAX ? t : `${t.slice(0, BIO_MAX - 1)}…`;
}

/** Earliest four-digit year (1950..2099) among start dates; null when none parses. */
export function experienceYear(starts: readonly unknown[]): number | null {
  let min: number | null = null;
  for (const s of starts) {
    const text = typeof s === "string" ? s : typeof s === "number" ? String(s) : "";
    const m = /(?:19[5-9]\d|20\d\d)/.exec(text);
    if (m === null) continue;
    const y = Number(m[0]);
    if (min === null || y < min) min = y;
  }
  return min;
}

/**
 * Every `ref.facts` entry among ledger rows, newest row per step winning (a retried step overwrites its earlier
 * facts), ordered by FACTS_STEPS then by first appearance; rows that do not parse are skipped.
 */
export function readProfileFacts(rows: readonly LedgerRow[]): ProfileFacts[] {
  const byStep = new Map<string, ProfileFacts[]>();
  for (const row of rows) {
    if (typeof row.step !== "string" || typeof row.ref_json !== "string") continue;
    try {
      const ref: unknown = JSON.parse(row.ref_json);
      if (typeof ref !== "object" || ref === null || !(FACTS_REF_KEY in ref)) continue;
      const parsed = z.array(ProfileFacts).safeParse((ref as Record<string, unknown>)[FACTS_REF_KEY]);
      if (parsed.success) byStep.set(row.step, parsed.data);
    } catch {
      /* malformed row: skip */
    }
  }
  const order = (step: string): number => {
    const i = FACTS_STEPS.indexOf(step);
    return i === -1 ? FACTS_STEPS.length : i;
  };
  return [...byStep.entries()].sort((a, b) => order(a[0]) - order(b[0])).flatMap(([, facts]) => facts);
}
