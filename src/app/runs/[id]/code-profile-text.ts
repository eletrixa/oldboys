/**
 * Code contributions: the numbers of a CodeProfile as labelled groups and plain text lines, shared by the card and the interview kit.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/code-profile-text.ts
 * Deps:    src/domain/code-profile (types, CODE_PROFILE_CAVEATS)
 * Tested:  src/app/runs/[id]/__tests__/code-profile-card.test.ts
 *
 * Key responsibilities:
 * - fmtInt: integers with thin-space thousands separators (U+2009)
 * - sourceFor: the `source_urls` entry a number group was read from (user, repos, search, events, orgs), http(s) only
 * - statGroups: the compact stat row (label, value, source link or null)
 * - codeProfileLines: the same numbers, repo table, merged-PR sample, orgs, the profile-page numbers (apify), pending stats and caveats as plain text lines;
 *   empty without a profile
 *
 * Design constraints:
 * - Pure; numbers only, no score and no adjective about the person; public work only
 */
import { CODE_PROFILE_CAVEATS, type CodeProfile } from "@/domain/code-profile";

const THIN_SPACE = " ";
const MINUS = "−";

export const PENDING_PREFIX = "GitHub had not computed statistics yet for: ";

export function fmtInt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
}

/** http(s) URLs only, so a malformed digest can never render a javascript: link. */
export function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export type SourceKind = "user" | "repos" | "search" | "events" | "orgs";

/** The URL in `source_urls` a number group was read from; the user group falls back to the profile URL. */
export function sourceFor(profile: CodeProfile, kind: SourceKind): string | null {
  const urls = profile.source_urls;
  const pick = (pred: (u: string) => boolean): string | undefined => urls.find((u) => safeHref(u) !== null && pred(u));
  const found =
    kind === "repos" ? pick((u) => u.includes("/repos?"))
    : kind === "search" ? pick((u) => u.includes("search/issues"))
    : kind === "events" ? pick((u) => u.includes("/events"))
    : kind === "orgs" ? pick((u) => u.includes("/orgs"))
    : (pick((u) => u.includes("/users/") && !/\/(repos|events|orgs)\b/.test(u)) ?? profile.profile_url);
  return found === undefined ? null : safeHref(found);
}

export type StatGroup = { label: string; value: string; source: string | null };

function accountYears(created: string | null, now: Date): string | null {
  if (created === null) return null;
  const t = Date.parse(created);
  if (Number.isNaN(t)) return null;
  const years = Math.floor((now.getTime() - t) / (365.25 * 86_400_000));
  return `${String(Math.max(years, 0))} ${years === 1 ? "year" : "years"} (since ${created.slice(0, 10)})`;
}

export function statGroups(p: CodeProfile, now: Date = new Date()): StatGroup[] {
  const e = p.recent_events;
  const age = accountYears(p.account_created, now);
  return [
    { label: "Own repositories", value: `${fmtInt(p.repos_sampled)} sampled of ${fmtInt(p.repos_owned)} owned`, source: sourceFor(p, "repos") },
    { label: "Commits", value: fmtInt(p.commits), source: null },
    { label: "Lines", value: `+${fmtInt(p.additions)} / ${MINUS}${fmtInt(p.deletions)}`, source: null },
    { label: "Stars received", value: fmtInt(p.stars_received), source: sourceFor(p, "repos") },
    { label: "PRs merged elsewhere", value: fmtInt(p.merged_prs_elsewhere), source: sourceFor(p, "search") },
    {
      label: "Public events, last 90 days",
      value: `${fmtInt(e.pushes)} pushes, ${fmtInt(e.pull_requests)} PRs, ${fmtInt(e.issues)} issues, ${fmtInt(e.reviews)} reviews`,
      source: sourceFor(p, "events"),
    },
    ...(age === null ? [] : [{ label: "Account age", value: age, source: sourceFor(p, "user") }]),
  ];
}

export function sharePct(share: number | null): string {
  return share === null ? "n/a" : `${String(Math.round(share * 100))}%`;
}

export function weeks(first: string | null, last: string | null): string {
  return first === null || last === null ? "n/a" : `${first} to ${last}`;
}

export function repoNumbers(r: CodeProfile["repos"][number]): { commits: string; lines: string } {
  return {
    commits: r.commits === null ? "n/a" : fmtInt(r.commits),
    lines: r.additions === null || r.deletions === null ? "n/a" : `+${fmtInt(r.additions)} / ${MINUS}${fmtInt(r.deletions)}`,
  };
}

/** The numbers as plain text lines (no Markdown); [] without a profile. */
export function codeProfileLines(profile: CodeProfile | null, now: Date = new Date()): string[] {
  if (profile === null) return [];
  const lines = [`GitHub: ${profile.handle} (${profile.profile_url}), public work only`];
  for (const g of statGroups(profile, now)) lines.push(`${g.label}: ${g.value}${g.source === null ? "" : ` (${g.source})`}`);
  if (profile.languages.length > 0) lines.push(`Languages: ${profile.languages.map((l) => `${l.name} (${fmtInt(l.repos)})`).join(", ")}`);
  for (const r of profile.repos) {
    const n = repoNumbers(r);
    lines.push(
      `Repo ${r.full_name}: ${n.commits} commits, ${n.lines} lines, ${sharePct(r.share)} of its commits, ${weeks(r.first_week, r.last_week)}, ${r.language ?? "no main language"}, ${fmtInt(r.stars)} stars (${r.source_url})`,
    );
  }
  for (const pr of profile.merged_prs_sample) lines.push(`Merged PR in ${pr.repo}: ${pr.title} (${pr.url})`);
  if (profile.orgs.length > 0) lines.push(`Organizations: ${profile.orgs.join(", ")}`);
  const a = profile.apify;
  if (a !== null) {
    if (a.last_year_contributions !== null) lines.push(`From the GitHub profile page (via Apify), contributions in the last year: ${fmtInt(a.last_year_contributions)} (${a.source_url})`);
    if (a.first_commit_year !== null) lines.push(`From the GitHub profile page (via Apify), first commit: ${String(a.first_commit_year)}`);
    for (const r of a.pinned_repos) lines.push(`Pinned repo ${r.name}: ${fmtInt(r.stars)} stars, ${fmtInt(r.forks)} forks${r.languages.length > 0 ? `, ${r.languages.join("/")}` : ""} (${r.url})`);
    if (a.achievements.length > 0) lines.push(`Profile achievements: ${a.achievements.join(", ")}`);
  }
  if (profile.stats_pending.length > 0) lines.push(`${PENDING_PREFIX}${profile.stats_pending.join(", ")}`);
  lines.push("What these numbers cannot tell you:", ...CODE_PROFILE_CAVEATS.map((c) => `- ${c}`));
  return lines;
}
