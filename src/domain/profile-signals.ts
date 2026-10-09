/**
 * Profile signals (plans/012): deterministic sentences about a candidate's confirmed public accounts, each with a source link.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/profile-signals.ts
 * Deps:    src/domain/profile-facts (ProfileFacts), src/domain/code-profile (CodeProfile), src/domain/claim (Candidate), src/domain/similar (nearDuplicate, tokens)
 * Tested:  src/domain/__tests__/profile-signals.test.ts
 *
 * Key responsibilities:
 * - `profileSignals(input)`: rules table (RULES in plans/012 00-SYNTHESIS): young-account, account-vs-career,
 *   follow-asymmetry, forks-only, linkedin-verified, few-connections, same-headline (pair), plus not-checked lines
 *   per platform without facts and the fixed LinkedIn creation-date line
 * - Every sentence describes an ACCOUNT (one fact per sentence, numbers and dates), never the person; `ask` is a
 *   neutral interview question or null
 * - `PROFILE_SIGNAL_CAVEATS`: fixed honesty lines shown with the card
 *
 * Design constraints:
 * - Pure, no I/O, no model; thresholds are constants in one table, relative to `now`, conjunctive where the
 *   literature says single counts fire on ordinary people (plans/012 06-pre-mortem T1)
 * - No score, no count, no colour, no verdict word: every template passes JUDGEMENT and ACCUSATION (challenge.ts)
 * - A pair label only describes text overlap ("carries the same headline text"), never a decision about the namesake
 */
import type { Candidate } from "./claim";
import type { CodeProfile } from "./code-profile";
import type { ProfileFacts } from "./profile-facts";
import { nearDuplicate, tokens } from "./similar";

export type SignalId =
  | "young-account"
  | "account-vs-career"
  | "follow-asymmetry"
  | "forks-only"
  | "linkedin-verified"
  | "few-connections"
  | "same-headline";

export type Signal = {
  id: SignalId;
  platform: string;
  /** The account the sentence is about (a namesake's url for `same-headline`). */
  profile_url: string;
  text: string;
  source_url: string;
  /** Neutral interview question, or null when the sentence is only context (positive or informational). */
  ask: string | null;
};

export type ProfileSignals = {
  /** Sentences worth reading, salient first (asks before context). */
  signals: Signal[];
  /** "LinkedIn does not publish the account creation date without login." and platforms with no facts. */
  not_checked: string[];
  /** Platforms whose facts were read (for the card's "checked" line). */
  checked: string[];
};

export type ProfileSignalsInput = {
  facts: readonly ProfileFacts[];
  codeProfile: CodeProfile | null;
  candidates: readonly Candidate[];
  /** ISO timestamp the rules are relative to (the request time); injected for tests. */
  now: string;
};

export const PROFILE_SIGNAL_CAVEATS: readonly string[] = [
  "Public account data only: what each platform shows without login.",
  "Thresholds follow published research on impersonation and account age; they are not calibrated on Czech data.",
  "Only accounts confirmed in the identity lineup are read; a namesake's numbers never appear here.",
  "Someone using another person's real identity and photos is not visible from public profiles.",
  "Each line is one fact about an account, with the page it was read from; none is a rating of the person.",
];

export const LINKEDIN_CREATION_NOTE = "LinkedIn does not publish the account creation date without login.";

const DAY_MS = 86_400_000;
const THIN_SPACE = "\u2009";
const YOUNG_DAYS = 180;
const CAREER_ACCOUNT_DAYS = 365;
const CAREER_YEARS = 5;
const FOLLOWING_MIN = 500;
const FOLLOWING_RATIO = 10;
const FORKS_MIN_OWNED = 5;
const FORKS_SHARE = 0.8;
const FEW_CONNECTIONS = 50;
const HEADLINE_MIN_TOKENS = 6;

const PLATFORM_LABELS: Readonly<Record<string, string>> = {
  x: "X",
  linkedin: "LinkedIn",
  github: "GitHub",
  tiktok: "TikTok",
  youtube: "YouTube",
  bluesky: "Bluesky",
  instagram: "Instagram",
};
const NOT_READ_PLATFORMS: readonly string[] = ["x", "github", "instagram"];

const label = (platform: string): string => PLATFORM_LABELS[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
const fmtInt = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

type Created = { ms: number; shown: string; text: string };

/** Platform date strings without a zone are read as UTC, so the output date does not depend on the server's zone. */
function inUtc(text: string): string {
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(text) || /(?:Z|GMT|UTC|[+-]\d{2}:?\d{2})$/i.test(text)) return text;
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? `${text}Z` : `${text} UTC`;
}

/** Lenient creation date: a parseable date, else a four-digit year with an optional month. A bare year counts as its last day, never later than now. */
function parseCreated(raw: string | null, nowMs: number): Created | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  const bareYear = /^(?:19|20)\d\d$/.test(trimmed);
  const t = bareYear ? Number.NaN : Date.parse(inUtc(trimmed));
  if (!Number.isNaN(t)) return { ms: t, shown: isoDay(t), text: `on ${isoDay(t)}` };
  const y = /\b((?:19|20)\d\d)\b/.exec(trimmed);
  if (y?.[1] === undefined) return null;
  const year = Number(y[1]);
  return { ms: Math.min(Date.UTC(year, 11, 31), nowMs), shown: String(year), text: `in ${String(year)}` };
}

const ageDays = (c: Created, nowMs: number): number => (nowMs - c.ms) / DAY_MS;

export function profileSignals(input: ProfileSignalsInput): ProfileSignals {
  const nowMs = Date.parse(input.now);
  const nowYear = new Date(nowMs).getUTCFullYear();
  const accounts = new Map<string, ProfileFacts>();
  for (const f of input.facts) accounts.set(`${f.platform}|${f.url}`, f);
  const facts = [...accounts.values()];
  const linkedin = facts.filter((f) => f.platform === "linkedin");
  const careerYears = linkedin.flatMap((f) => (f.earliest_experience_year === null ? [] : [f.earliest_experience_year]));
  const careerStart = careerYears.length > 0 ? Math.min(...careerYears) : null;
  const longCareer = careerStart !== null && careerStart <= nowYear - CAREER_YEARS ? careerStart : null;

  const out: Record<SignalId, Signal[]> = {
    "young-account": [],
    "account-vs-career": [],
    "follow-asymmetry": [],
    "forks-only": [],
    "linkedin-verified": [],
    "few-connections": [],
    "same-headline": [],
  };
  const push = (id: SignalId, f: ProfileFacts, text: string, ask: string | null): void => {
    out[id].push({ id, platform: f.platform, profile_url: f.url, text, source_url: f.source_url, ask });
  };

  for (const f of facts) {
    const name = label(f.platform);
    const created = parseCreated(f.created_at, nowMs);
    if (created !== null && !Number.isNaN(nowMs)) {
      const age = ageDays(created, nowMs);
      const ask = `Your ${name} account was created ${created.text}. Is it your only account there?`;
      if (age >= 0 && age <= CAREER_ACCOUNT_DAYS && longCareer !== null && f.platform !== "linkedin") {
        push("account-vs-career", f, `The ${name} account dates from ${created.shown}; the confirmed LinkedIn profile lists roles since ${String(longCareer)}.`, ask);
      } else if (age >= 0 && age <= YOUNG_DAYS) {
        push("young-account", f, `The ${name} account was created ${created.text}.`, ask);
      }
    }
    if (f.following !== null && f.following >= FOLLOWING_MIN && f.following >= FOLLOWING_RATIO * (f.followers ?? Number.POSITIVE_INFINITY)) {
      push("follow-asymmetry", f, `${name}: ${fmtInt(f.followers ?? 0)} followers, follows ${fmtInt(f.following)}.`, null);
    }
    if (f.platform === "linkedin" && f.verified === true) push("linkedin-verified", f, "LinkedIn shows the verified badge on this profile.", null);
    if (f.platform === "linkedin" && f.connections !== null && f.connections < FEW_CONNECTIONS && longCareer !== null && f.earliest_experience_year !== null) {
      push("few-connections", f, `LinkedIn: ${fmtInt(f.connections)} connections; roles listed since ${String(f.earliest_experience_year)}.`, null);
    }
  }

  const cp = input.codeProfile;
  if (cp !== null && cp.repos_owned >= FORKS_MIN_OWNED && cp.forks_excluded >= FORKS_SHARE * cp.repos_owned) {
    out["forks-only"].push({
      id: "forks-only",
      platform: "github",
      profile_url: cp.profile_url,
      text: `GitHub: ${fmtInt(cp.forks_excluded)} of ${fmtInt(cp.repos_owned)} public repositories are forks.`,
      source_url: cp.sources.repos,
      ask: "Which of your GitHub repositories is your own work?",
    });
  }

  const merged = input.candidates.filter((c) => c.decision === "merge");
  const headline = linkedin.find((f) => f.bio !== null)?.bio ?? merged.find((c) => c.platform === "linkedin")?.snippet ?? null;
  if (headline !== null && tokens(headline).size >= HEADLINE_MIN_TOKENS) {
    for (const c of input.candidates) {
      const url = c.profile_urls[0];
      if (c.decision === "merge" || url === undefined || !nearDuplicate(c.snippet, headline)) continue;
      out["same-headline"].push({
        id: "same-headline",
        platform: c.platform,
        profile_url: url,
        text: `A namesake profile on ${label(c.platform)} carries the same headline text as the confirmed profile.`,
        source_url: url,
        ask: null,
      });
    }
  }

  const all = Object.values(out).flat();
  const signals = [...all.filter((s) => s.ask !== null), ...all.filter((s) => s.ask === null)];

  const checked = [...new Set(facts.map((f) => f.platform))];
  const not_checked = [LINKEDIN_CREATION_NOTE];
  for (const p of NOT_READ_PLATFORMS) {
    if (!checked.includes(p) && merged.some((c) => c.platform === p)) not_checked.push(`${label(p)}: account details were not read on this run.`);
  }
  return { signals, not_checked, checked };
}
