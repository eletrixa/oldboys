/**
 * Shared types and pure helpers for the run view (state shape, progress rows).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/state.ts
 * Deps:    src/domain/claim, src/domain/run-cost (types only)
 * Tested:  src/app/runs/[id]/__tests__/state.test.ts
 *
 * Key responsibilities:
 * - RunState: the GET /api/runs/:id/state contract
 * - stepRows: map the ledger step + status to the five human progress rows
 * - sortLineup: confirmed first, social platforms before web hits
 * - questionsToAsk: one open profile per platform; roleCriteria: role must-haves (mh-) only
  * - evidenceGroup: the heading a confirmed source sits under, from its URL's platform (LinkedIn, X), not the actor
 * - searchedTitle: "Searched, nothing confirmed" when a gap is namesake-only, else "nothing found"
 * - GAP_LABEL, gapLine, searchedEmpty: human gap lines, shared by BriefView and the interview kit
 * - briefSections (confidence descending, null for briefs stored before sections), confidenceBand, host
 * - headerText / firstName: the run page title; "the candidate" until the seed step derived a name (plans/006)
 * - seedHeadline: the headline the seed_profile ledger row recorded
 *
 * Design constraints:
 * - Pure (types plus the pure platformOf), so both the route handler and client code can use it
 */
import type { Brief, BriefSection, Candidate, Claim } from "@/domain/claim";
import type { RunCost } from "@/domain/run-cost";
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
  /** ISO timestamp the run was created; drives the CACHED label. */
  created_at: string;
  status: RunStatus;
  step: string | null;
  mentions: number;
  candidates: Candidate[];
  claims: Claim[];
  sources: { id: string; url: string }[];
  questions: { id: string; text: string }[];
  brief: Brief | null;
  /** Reason recorded by the Workflow when status is failed; null otherwise. */
  failure: string | null;
  /** Recipe step that was running when the run failed (the first one without a ledger row); null otherwise. */
  failed_step: string | null;
  /** Recipe steps already in the ledger, and the recipe length; drives the progress bar. */
  step_index: number;
  step_count: number;
  cost: RunCost;
};

export type RowState = "done" | "active" | "todo" | "failed" | "skipped";

export const PLATFORM_RANK: Record<string, number> = { linkedin: 0, github: 1, x: 2, instagram: 3, tiktok: 4, youtube: 5, bluesky: 6, facebook: 7 };

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

/**
 * Heading for an evidence row: the URL's platform label ("LinkedIn" even when a web search found it); plain web
 * pages fall back to the step label (`stepLabels`, e.g. "ARES registry", "Website") or "Web search".
 */
export function evidenceGroup(e: { step: string; url: string }, stepLabels: Readonly<Record<string, string>> = {}): string {
  return PLATFORM_LABEL[platformOf(e.url)] ?? stepLabels[e.step] ?? "Web search";
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
  return gaps.some((g) => g.reason.includes("none confirmed")) ? "Searched, nothing confirmed" : "Searched, nothing found";
}

/** Human labels for recipe step ids that appear in the gap lists. */
export const GAP_LABEL: Record<string, string> = {
  serp_person: "Web search",
  social_serp: "Social profile search",
  linkedin_profile: "LinkedIn",
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
  facebook_profile: "Facebook",
};

type Gap = Brief["not_searched"][number];

/** `searched_empty` is defaulted for older briefs; read it without trusting a stored brief to have it. */
export function searchedEmpty(brief: Brief): Gap[] {
  const b: unknown = brief;
  return typeof b === "object" && b !== null && "searched_empty" in b && Array.isArray(b.searched_empty) ? (b.searched_empty as Gap[]) : [];
}

/** "LinkedIn: no public profile" — step id replaced by its human label. */
export const gapLine = (g: Gap): string => `${GAP_LABEL[g.source] ?? g.source}: ${g.reason}`;

/** Sections by confidence, highest first; null when the stored brief predates sections (render per question instead). */
export function briefSections(brief: Brief): BriefSection[] | null {
  const b: unknown = brief;
  if (typeof b !== "object" || b === null || !("sections" in b) || !Array.isArray(b.sections) || b.sections.length === 0) return null;
  return (b.sections as BriefSection[]).toSorted((x, y) => y.confidence - x.confidence);
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
