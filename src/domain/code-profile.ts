/**
 * Code profile: the numbers a GitHub deep scrape produced for a technical candidate, each traceable to a source URL.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/code-profile.ts
 * Deps:    zod
 * Tested:  src/domain/__tests__/code-profile.test.ts
 *
 * Key responsibilities:
 * - `CodeProfile`: Zod schema of the digest the `rest/github-deep` collector writes into its ledger ref (`ref.digest`)
 * - `TECHNICAL_FAMILIES`: role families for which the hiring recipe scrapes GitHub in depth (engineering, data; AI falls
 *   under one of them in `familyOf`)
 * - `ApifyGithubProfile`: what the Apify profile actor step (`github_apify`) adds (last-year contributions, pinned repos, achievements)
 * - `readDigest` (shared with src/domain/cz-registry): latest `ref.digest` of a step among ledger rows
 * - `readCodeProfile`: latest `github_deep` digest from ledger rows with the `github_apify` digest attached (same handle), parsed
 *   defensively (null for runs before the feature or non-technical roles)
 * - `codeTotals`: repos sampled, commits, lines added and removed summed over `repos`
 * - `codeProfileCaveats`: the fixed honesty lines shown with the numbers (private work invisible, forks excluded, LoC is a weak proxy)
 *
 * Design constraints:
 * - Pure, no I/O; every number carries the source URL it was read from (`sources`, `repos[].source_url`), so the report can link it
 * - Numbers describe public code only; never a score of the person
 */
import { z } from "zod";
import type { Family } from "./position";

export const TECHNICAL_FAMILIES: readonly Family[] = ["engineering", "data"];

export function isTechnicalFamily(family: Family | null): boolean {
  return family !== null && TECHNICAL_FAMILIES.includes(family);
}

export const RepoContribution = z.object({
  /** "owner/name" */
  full_name: z.string().min(1),
  url: z.string().min(1),
  /** The candidate's own commits in this repo (stats/contributors `total`), null when stats were not ready (202). */
  commits: z.number().int().nonnegative().nullable(),
  additions: z.number().int().nonnegative().nullable(),
  deletions: z.number().int().nonnegative().nullable(),
  /** ISO week of the first and last week with a commit by the candidate; null without stats. */
  first_week: z.string().nullable(),
  last_week: z.string().nullable(),
  language: z.string().nullable(),
  stars: z.number().int().nonnegative(),
  /** Share of all commits in the repo made by the candidate (0..1), null without stats. */
  share: z.number().min(0).max(1).nullable(),
  /** repo stats URL this row was read from */
  source_url: z.string().min(1),
});
export type RepoContribution = z.infer<typeof RepoContribution>;

export const MergedPullRequest = z.object({
  /** "owner/name" of someone else's repository */
  repo: z.string().min(1),
  title: z.string(),
  url: z.string().min(1),
  merged_at: z.string().nullable(),
});
export type MergedPullRequest = z.infer<typeof MergedPullRequest>;

/** What the Apify profile actor (saswave/github-profile-scraper, step `github_apify`) adds: the public profile page's own numbers. */
export const ApifyGithubProfile = z.object({
  handle: z.string().min(1),
  /** "N contributions in the last year" from the profile page; null when the page did not show it. */
  last_year_contributions: z.number().int().nonnegative().nullable(),
  /** Year of the first commit the profile page lists; null when unknown. */
  first_commit_year: z.number().int().nullable(),
  pinned_repos: z.array(z.object({ name: z.string().min(1), url: z.string().min(1), stars: z.number().int().nonnegative(), forks: z.number().int().nonnegative(), languages: z.array(z.string()) })),
  achievements: z.array(z.string()),
  /** Apify dataset or run URL the numbers were read from. */
  source_url: z.string().min(1),
});
export type ApifyGithubProfile = z.infer<typeof ApifyGithubProfile>;

export const CodeProfile = z.object({
  handle: z.string().min(1),
  profile_url: z.string().min(1),
  /** Public repos owned (forks included) and how many of them are forks; the sampled repos with stats are `repos` (see `codeTotals`). */
  repos_owned: z.number().int().nonnegative(),
  forks_excluded: z.number().int().nonnegative(),
  /** Repos whose stats answered 202 twice (not counted); named so the gap is honest. */
  stats_pending: z.array(z.string()),
  repos: z.array(RepoContribution),
  /** Languages by number of own repos using them as the main language, descending. */
  languages: z.array(z.object({ name: z.string().min(1), repos: z.number().int().positive() })),
  stars_received: z.number().int().nonnegative(),
  /** Pull requests by the candidate merged into repositories they do not own. */
  merged_prs_elsewhere: z.number().int().nonnegative(),
  merged_prs_sample: z.array(MergedPullRequest),
  /** Public events in the last 90 days (GitHub keeps at most 300): pushes, PRs, issues, reviews. */
  recent_events: z.object({ pushes: z.number().int().nonnegative(), pull_requests: z.number().int().nonnegative(), issues: z.number().int().nonnegative(), reviews: z.number().int().nonnegative(), since: z.string().nullable() }),
  orgs: z.array(z.string()),
  account_created: z.string().nullable(),
  /** The GitHub API URLs the number groups were read from (per-repo stats URLs are `repos[].source_url`), so each metric links to evidence. */
  sources: z.object({ user: z.string().min(1), repos: z.string().min(1), search: z.string().min(1), events: z.string().min(1), orgs: z.string().min(1) }),
  /** Attached by `readCodeProfile` from the `github_apify` step's digest; null when that step did not run. */
  apify: ApifyGithubProfile.nullable().default(null),
});
export type CodeProfile = z.infer<typeof CodeProfile>;

/** Sums over `repos` (the sampled repos whose stats were ready). */
export function codeTotals(p: CodeProfile): { repos_sampled: number; commits: number; additions: number; deletions: number } {
  return p.repos.reduce(
    (t, r) => ({ repos_sampled: t.repos_sampled + 1, commits: t.commits + (r.commits ?? 0), additions: t.additions + (r.additions ?? 0), deletions: t.deletions + (r.deletions ?? 0) }),
    { repos_sampled: 0, commits: 0, additions: 0, deletions: 0 },
  );
}

export const CODE_PROFILE_STEP = "github_deep";
export const APIFY_PROFILE_STEP = "github_apify";

export const CODE_PROFILE_CAVEATS: readonly string[] = [
  "Private repositories and private contributions are invisible; the numbers cover public work only.",
  "Forked repositories are excluded from own-work counts.",
  "Lines added and removed count generated, vendored and moved code alike; they show activity, not quality.",
  "Per-repo statistics are GitHub's own, computed for the sampled repositories only.",
  "Only the GitHub account confirmed in the identity lineup is counted; a namesake's account never is.",
];

export type LedgerRow = { step?: string | null; ref_json?: string | null };

/** Latest `ref.digest` of `step` among ledger rows that parses with `schema`; null when absent or malformed. Shared with cz-registry. */
export function readDigest<T>(rows: readonly LedgerRow[], step: string, schema: z.ZodType<T>): T | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row?.step !== step || typeof row.ref_json !== "string") continue;
    try {
      const ref: unknown = JSON.parse(row.ref_json);
      const digest = typeof ref === "object" && ref !== null && "digest" in ref ? ref.digest : undefined;
      const parsed = schema.safeParse(digest);
      if (parsed.success) return parsed.data;
    } catch {
      /* malformed row: keep looking */
    }
  }
  return null;
}

/** github_deep digest, with the github_apify digest attached when both exist; null for older runs and non-technical roles. */
export function readCodeProfile(rows: readonly LedgerRow[]): CodeProfile | null {
  const profile = readDigest(rows, CODE_PROFILE_STEP, CodeProfile);
  if (profile === null) return null;
  const apify = readDigest(rows, APIFY_PROFILE_STEP, ApifyGithubProfile);
  return apify?.handle.toLowerCase() === profile.handle.toLowerCase() ? { ...profile, apify } : profile;
}
