/**
 * Shared types and pure helpers for the run view (state shape, progress rows).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/state.ts
 * Deps:    src/domain/claim, src/domain/challenge, src/domain/code-profile (type), src/domain/profile-signals (type), src/domain/run-issues (type), src/domain/run-cost, src/domain/quote, src/app/intake/intake-rows (types only)
 * Tested:  src/app/runs/[id]/__tests__/state.test.ts
 *
 * Key responsibilities:
 * - RunState: the GET /api/runs/:id/state contract (incl. position {id, title} | null, organization_name, and intake = the application that started the run, or null;
 *   sources carry fetched_at / expires_at and quote_contexts the saved text around each claim's quote, never whole excerpts;
 *   challenges / challenge_summary = the devil's advocate record, optional for older runs; code_profile = the GitHub deep scrape digest, null or absent without one;
 *   profile_signals = deterministic sentences about the confirmed public accounts, null or absent for older payloads;
 *   issues = problems the ledger recorded so far (readRunIssues, reasons scrubbed), shown while the run loads; absent for older payloads)
 * - stepRows: map the ledger step + status to the five human progress rows
 * - sortLineup: confirmed first, social platforms before web hits
 * - questionsToAsk: one open profile per platform; roleCriteria: role must-haves (mh-) only
  * - evidenceGroup: the heading a confirmed source sits under, from its URL's platform (LinkedIn, X, CV), not the actor
 * - isCvSource / CV_SOURCE_TEXT: the pasted CV ("cv:<runId>") renders as text, never as a link
 * - hiringFor: the position title when the run has one, else the role; the one answer for the brief header, the
 *   interview kit, the ATS note and the reference questions
 * - searchedTitle: "Searched, nothing confirmed" when a gap is namesake-only, else "nothing found"
 * - GAP_LABEL, gapText, gapLine, searchedEmpty: human gap lines (raw request errors turned into plain words), shared by BriefView and the interview kit
 * - briefSections (confidence descending, null for briefs stored before sections), isShown (sections worth a card), confidenceBand, host
 * - headerText / firstName: the run page title; "the candidate" until the seed step derived a name (plans/006)
 * - retryHref / stalledNotice / startedAgo: where "start again" goes, whether to show the stalled notice, the elapsed line
 * - seedHeadline: the headline the seed_profile ledger row recorded
 *
 * Design constraints:
 * - Pure (types plus the pure platformOf), so both the route handler and client code can use it
 */
import type { Challenge } from "@/domain/challenge";
import type { CodeProfile } from "@/domain/code-profile";
import type { ProfileSignals } from "@/domain/profile-signals";
import type { RegistryChecks } from "@/domain/cz-registry";
import type { RunIssue } from "@/domain/run-issues";
import { PLATFORM_LABEL } from "@/domain/profile-facts";
import type { Brief, BriefSection, Candidate, Claim } from "@/domain/claim";
import type { ClaimQuoteContext } from "@/domain/quote";
import type { RunCost } from "@/domain/run-cost";
import type { RunIntake } from "@/app/intake/intake-rows";
import { isStalled } from "@/domain/run-status";
import { platformOf } from "@/recipe/sources/types";

export type RunStatus = "queued" | "running" | "paused" | "done" | "failed";

export type RunState = {
  id: string;
  /** "" until the seed step derived the name from the LinkedIn profile or CV (profile-first runs). */
  subject: string;
  /** Headline the seed step read from the given profile or CV; null when none (or older runs). */
  headline: string | null;
  /** Role the manager is hiring for (hiring goal); null for other goals and older runs. */
  role: string | null;
  /** Position the run was started from (specs/positions-start); null for runs without one or whose position was purged. */
  position?: { id: string; title: string } | null;
  /** Recruiter's organization when the run was started from a logged-in browser; null for bearer/extension runs. */
  organization_name: string | null;
  /** ISO timestamp the run was created; drives the CACHED label. */
  created_at: string;
  /** ISO time of the newest ledger row (created_at when none); optional for older payloads. */
  last_at?: string;
  status: RunStatus;
  step: string | null;
  mentions: number;
  candidates: Candidate[];
  claims: Claim[];
  /**
   * identity_reason: why a source was confirmed beyond its profile link ("name and employer match (Groupon)"); null otherwise.
   * fetched_at: when we read the source; expires_at: when the saved excerpt is purged (both ISO; absent in older code paths).
   */
  sources: { id: string; url: string; identity_reason?: string | null; fetched_at?: string | null; expires_at?: string | null }[];
  /** Saved text around each claim's quote, one per (shown claim with a quote, confirmed source it cites); none touching an Art. 9 topic. */
  quote_contexts?: ClaimQuoteContext[];
  /** Devil's advocate (idea #8): claims that did not hold, with ground and a source-level reason; empty or absent for older runs. */
  challenges?: Challenge[];
  /** How many findings the devil's advocate checked, how many held, how many moved to the interview; null or absent for older runs. */
  challenge_summary?: { checked: number; held: number; moved: number } | null;
  /** GitHub deep scrape digest (technical roles); null or absent otherwise. */
  code_profile?: CodeProfile | null;
  /** Profile signals (plans/012): sentences about the confirmed public accounts, each with a source; null or absent when the route did not compute them. */
  profile_signals?: ProfileSignals | null;
  /** Czech public registry checks (cz_registries step digest); null or absent for older runs. */
  registry_checks?: RegistryChecks | null;
  /** Problems the ledger recorded so far (failed requests, budget stops, sources not searched, searched empty, AI off); [] for a clean run, absent for older payloads. */
  issues?: RunIssue[];
  questions: { id: string; text: string; title?: string }[];
  brief: Brief | null;
  /** Reason recorded by the Workflow when status is failed; null otherwise. */
  failure: string | null;
  /** Recipe step that was running when the run failed (the first one without a ledger row); null otherwise. */
  failed_step: string | null;
  /** Recipe steps already in the ledger, and the recipe length; drives the progress bar. */
  step_index: number;
  step_count: number;
  cost: RunCost;
  /** The intake application that started this run (source, tag, received time); null for runs started by hand. */
  intake: RunIntake | null;
};

export type RowState = "done" | "active" | "todo" | "failed" | "skipped";

export const PLATFORM_RANK: Record<string, number> = { linkedin: 0, github: 1, x: 2, instagram: 3, tiktok: 4, youtube: 5, bluesky: 6, facebook: 7 };

export { PLATFORM_LABEL };

/**
 * Heading for an evidence row: the URL's platform label ("LinkedIn" even when a web search found it); plain web
 * pages fall back to the step label (`stepLabels`, e.g. "ARES registry", "Website") or "Web search".
 */
export function evidenceGroup(e: { step: string; url: string }, stepLabels: Readonly<Record<string, string>> = {}): string {
  const platform = platformOf(e.url);
  if (platform === "cv") return "CV";
  return PLATFORM_LABEL[platform] ?? stepLabels[e.step] ?? "Web search";
}

/** What the page shows instead of a link for the pasted CV ("cv:<runId>" is not a web address). */
export const CV_SOURCE_TEXT = "Candidate's CV (pasted)";

export function isCvSource(url: string): boolean {
  return platformOf(url) === "cv";
}
const DECISION_RANK: Record<Candidate["decision"], number> = { merge: 0, "possibly-same-as": 1, rejected: 2 };

/** Lineup order: confirmed first, then open questions, social platforms before plain web hits. */
export function sortLineup<T extends Pick<Candidate, "platform" | "decision" | "score">>(candidates: readonly T[], decisionOf: (c: T) => Candidate["decision"]): T[] {
  return [...candidates].sort(
    (a, b) =>
      DECISION_RANK[decisionOf(a)] - DECISION_RANK[decisionOf(b)] ||
      (PLATFORM_RANK[a.platform] ?? 9) - (PLATFORM_RANK[b.platform] ?? 9) ||
      b.score - a.score,
  );
}

/** Index of the human row a ledger step belongs to; unknown steps are treated as collectors. */
function rowOf(step: string): number {
  if (step.startsWith("seed") || step.startsWith("serp") || step.startsWith("load") || step.startsWith("role") || step.startsWith("social")) return 0;
  if (step.startsWith("resolve")) return 1;
  if (step.startsWith("extract") || step.startsWith("verify")) return 3;
  if (step.startsWith("synthesize")) return 4;
  return 2;
}

/** Wireframe: one easy question at a time, and never more than a few; the rest keep the server's decision. */
export const LINEUP_MAX_QUESTIONS = 3;

/**
 * Candidates worth a question: the highest-scored open profile per platform (one question per platform, so three
 * questions reach three different profiles); plain web hits only fill up to `max` when fewer profiles are open.
 */
export function questionsToAsk(candidates: readonly Candidate[], max: number): Candidate[] {
  const open = sortLineup(
    candidates.filter((c) => c.decision === "possibly-same-as"),
    (c) => c.decision,
  );
  // sortLineup puts each platform's best score first, so the first row per platform wins
  const profiles = open.filter((c, i) => c.platform !== "web" && open.findIndex((o) => o.platform === c.platform) === i);
  const web = open.filter((c) => c.platform === "web");
  return (profiles.length < max ? [...profiles, ...web] : profiles).slice(0, max);
}

/** Role must-haves only (ids "mh-"); the base research prompts are not criteria and never shown as such. */
export function roleCriteria(questions: readonly { id: string; text: string }[]): string[] {
  return questions.filter((q) => q.id.startsWith("mh-")).map((q) => q.text);
}

export function stepRows(state: Pick<RunState, "status" | "step" | "mentions" | "failed_step"> & { degraded?: boolean }): RowState[] {
  // Degraded brief: nothing was read or double-checked by a model, so those two rows are skipped, not ticked.
  if (state.status === "done") return Array.from({ length: 5 }, (_, i) => (state.degraded === true && (i === 2 || i === 3) ? "skipped" : "done"));
  if (state.status === "failed") {
    const at = rowOf(state.failed_step ?? state.step ?? "");
    return Array.from({ length: 5 }, (_, i) => (i < at ? "done" : i === at ? "failed" : "todo"));
  }
  let current = state.step === null ? 0 : rowOf(state.step);
  if (current === 0 && state.mentions > 0) current = 1;
  return Array.from({ length: 5 }, (_, i) => (i < current ? "done" : i === current ? "active" : "todo"));
}

/** First name for copy, or null while the name is not known yet (profile-first run before the seed step). */
export function firstName(subject: string): string | null {
  const first = subject.trim().split(/\s+/)[0] ?? "";
  return first === "" ? null : first;
}

/** What the run is hiring for: the position title (live, when the run came from a position), else the role entered at start. */
export function hiringFor(state: Pick<RunState, "role" | "position">): string | null {
  return state.position?.title ?? state.role;
}

/** Run page title: "<First>'s brief" / "Putting together <First>'s brief", or "the candidate" / "the brief" before the name is known. */
export function headerText(subject: string, done: boolean): string {
  const first = firstName(subject);
  if (first === null) return done ? "The candidate's brief" : "Putting together the brief";
  return done ? `${first}'s brief` : `Putting together ${first}'s brief`;
}

/** Last headline a seed_profile ledger row recorded (ref.headline), null when none. */
export function seedHeadline(rows: readonly { step: string; ref_json: string | null }[]): string | null {
  for (const row of [...rows].reverse()) {
    if (row.step !== "seed_profile" || row.ref_json === null) continue;
    try {
      const ref: unknown = JSON.parse(row.ref_json);
      if (typeof ref === "object" && ref !== null && "headline" in ref && typeof ref.headline === "string" && ref.headline !== "") return ref.headline;
    } catch {
      continue;
    }
  }
  return null;
}

/** Gap list heading: "nothing confirmed" once any searched source returned only namesakes, else "nothing found". */
export function searchedTitle(gaps: readonly { reason: string }[]): string {
  return namesakeOnly(gaps) ? "Searched, nothing confirmed" : "Searched, nothing found";
}

/** True once any searched source returned only namesakes (the gap heading then says "nothing confirmed"). */
export function namesakeOnly(gaps: readonly { reason: string }[]): boolean {
  return gaps.some((g) => g.reason.includes("none confirmed"));
}

/** Human labels for recipe step ids that appear in the gap lists. */
export const GAP_LABEL: Record<string, string> = {
  serp_person: "Web search",
  social_serp: "Social profile search",
  instagram_search: "Instagram search",
  facebook_search: "Facebook search",
  linkedin_profile: "LinkedIn",
  linkedin_posts: "LinkedIn posts",
  employer_company: "Employer company page",
  github_profile: "GitHub",
  stackexchange_profile: "Stack Exchange",
  huggingface_profile: "Hugging Face",
  orcid_search: "ORCID",
  openalex_author: "OpenAlex",
  x_profile: "X",
  instagram_profile: "Instagram",
  tiktok_profile: "TikTok",
  youtube_channel: "YouTube",
  bluesky_profile: "Bluesky",
  personal_site_crawl: "Personal website",
  talks_serp: "Talks and posts",
  press_serp: "Press and awards search",
  facebook_profile: "Facebook",
  facebook_page: "Facebook page",
  role_sites_serp: "Role evidence sites",
  github_deep: "GitHub contributions",
  github_apify: "GitHub profile page",
  cz_registries: "Czech public registries",
};

type Gap = Brief["not_searched"][number];

/** `searched_empty` is defaulted for older briefs; read it without trusting a stored brief to have it. */
export function searchedEmpty(brief: Brief): Gap[] {
  const b: unknown = brief;
  return typeof b === "object" && b !== null && "searched_empty" in b && Array.isArray(b.searched_empty) ? (b.searched_empty as Gap[]) : [];
}

/** A gap reason in plain words: request errors lose their URL and JSON, a missing handle reads as a missing profile. */
export function gapText(reason: string): string {
  if (reason.startsWith("request failed:")) {
    const code = /\bHTTP (\d{3})\b/.exec(reason)?.[1];
    return code === undefined ? "the service did not answer" : `the service refused our request (HTTP ${code})`;
  }
  return reason === "no confirmed handle or id to look up" ? "no confirmed profile to look up" : reason;
}

/** "LinkedIn: no public profile" — step id replaced by its human label, reason in plain words. */
export const gapLine = (g: Gap): string => `${GAP_LABEL[g.source] ?? g.source}: ${gapText(g.reason)}`;

/** Sections by confidence, highest first; null when the stored brief predates sections (render per question instead). */
export function briefSections(brief: Brief): BriefSection[] | null {
  const b: unknown = brief;
  if (typeof b !== "object" || b === null || !("sections" in b) || !Array.isArray(b.sections) || b.sections.length === 0) return null;
  return (b.sections as BriefSection[]).toSorted((x, y) => y.confidence - x.confidence);
}

/** A section with no claims and no sources has nothing to show; a claimless social-presence section lists the profiles. */
export function isShown(s: BriefSection): boolean {
  return s.claim_ids.length > 0 || s.source_ids.length > 0;
}

export type ConfidenceBand = "strong" | "fair" | "weak";

/** >= 0.75 strong, 0.5 to 0.74 fair, below 0.5 weak. */
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.75) return "strong";
  return confidence >= 0.5 ? "fair" : "weak";
}

/** "linkedin.com" for a link label; the raw string when it does not parse. */
export function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Where "Try again" and "start again" go: the position's brief form when the run has a position, else home (the page may be opened without a session; home sends a signed-in user on). */
export function retryHref(position: RunState["position"]): string {
  return position ? `/briefs/new?positionId=${encodeURIComponent(position.id)}` : "/";
}

/** The notice for a run with no ledger activity for 30 minutes (same rule as My briefs), else null. */
export function stalledNotice(state: Pick<RunState, "status" | "created_at" | "last_at" | "position">, nowIso: string): { href: string } | null {
  return isStalled(state.status, state.last_at ?? state.created_at, nowIso) ? { href: retryHref(state.position) } : null;
}

/** "Started 1 min ago", from the creation time; null when the time is unreadable. */
export function startedAgo(createdAt: string, nowMs: number): string | null {
  const ms = nowMs - Date.parse(createdAt);
  if (!Number.isFinite(ms)) return null;
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 1) return "Started just now";
  if (min < 60) return `Started ${String(min)} min ago`;
  const h = Math.floor(min / 60);
  return `Started ${String(h)} h ${String(min % 60)} min ago`;
}
