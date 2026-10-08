/**
 * 30-second summary: three short sentences on top of the brief, computed from RunState without a model.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/summary.ts
 * Deps:    src/recipe/sources/types (platformOf), ./state (RunState, labels, gap helpers), ./cv-check
 * Tested:  src/app/runs/[id]/__tests__/summary.test.ts, src/app/runs/[id]/__tests__/cv-check.test.ts (CV check)
 *
 * Key responsibilities:
 * - summary30s: what is documented (confirmed platforms, role criteria with evidence), what is missing (at most two
 *   gaps), what to ask (the first interview question or check), or null while there is no brief
 * - Degraded brief (AI off): confirmed sources only, criteria stated as not checked
 * - CV runs (idea #14): the documented sentence ends with cvSummaryLine ("CV: 3 statements match the public record,
 *   1 to ask about."); the CV check is never counted as a research question or listed as a gap
 * - summaryText: the three sentences as one string for "Read aloud"
 *
 * Design constraints:
 * - Pure and deterministic; summarises the research, never the candidate: no scores, verdicts or traits
 * - Confirmed data only (merged candidates, brief.evidence); brief.also_found (unconfirmed namesakes) never goes in
 */
import type { Brief } from "@/domain/claim";
import { platformOf } from "@/recipe/sources/types";
import { cvSummaryLine, isCvSection } from "./cv-check";
import { GAP_LABEL, PLATFORM_LABEL, PLATFORM_RANK, type RunState, searchedEmpty } from "./state";

export type Summary30s = { documented: string; missing: string; ask: string };

/** Longest sentence part, in characters; a manager reads three of them in 30 seconds. */
const MAX_PART = 90;

/** Cuts at a word boundary under `max` characters and adds "…"; trailing punctuation dropped. */
export function shorten(text: string, max = MAX_PART): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat.replace(/[.!?;:,]+$/, "");
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

/** "A", "A and B", "A, B and C". */
function joinAnd(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1] ?? ""}`;
}

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

/** Confirmed platforms (merged candidates plus confirmed evidence URLs) in lineup order, and other confirmed pages. */
function confirmed(state: RunState, brief: Brief): { platforms: string[]; other: number } {
  const merged = state.candidates.filter((c) => c.decision === "merge");
  const keys = new Set([...merged.map((c) => c.platform), ...brief.evidence.map((e) => platformOf(e.url))]);
  const platforms = [...keys]
    .filter((k) => k in PLATFORM_LABEL)
    .sort((a, b) => (PLATFORM_RANK[a] ?? 9) - (PLATFORM_RANK[b] ?? 9))
    .map((k) => PLATFORM_LABEL[k] ?? k);
  const otherUrls = new Set([
    ...merged.filter((c) => !(c.platform in PLATFORM_LABEL)).flatMap((c) => c.profile_urls.slice(0, 1)),
    ...brief.evidence.filter((e) => !(platformOf(e.url) in PLATFORM_LABEL)).map((e) => e.url),
  ]);
  return { platforms, other: otherUrls.size };
}

function confirmedPhrase(state: RunState, brief: Brief): string | null {
  const { platforms, other } = confirmed(state, brief);
  const parts = [
    ...(platforms.length > 0 ? [`${joinAnd(platforms)} ${platforms.length === 1 ? "profile" : "profiles"}`] : []),
    ...(other > 0 ? [plural(other, platforms.length > 0 ? "other source" : "web source")] : []),
  ];
  return parts.length === 0 ? null : joinAnd(parts);
}

/** No model ran: the brief is degraded, or every per-question summary is the "unavailable" placeholder. */
export function aiOff(brief: Brief): boolean {
  return brief.degraded !== null || (brief.per_question.length > 0 && brief.per_question.every((q) => q.summary.startsWith("AI summary unavailable")));
}

/** Per-question rows that are role must-haves (mh-); all rows but the CV check when the run has no role criteria. */
function criteriaRows(brief: Brief): { rows: Brief["per_question"]; noun: string } {
  const mh = brief.per_question.filter((q) => q.question_id.startsWith("mh-"));
  return mh.length > 0 ? { rows: mh, noun: "role criteria" } : { rows: brief.per_question.filter((q) => !isCvSection(q.question_id)), noun: "research questions" };
}

function documented(state: RunState, brief: Brief, off: boolean): string {
  const cv = cvSummaryLine(state);
  const base = researched(state, brief, off);
  return cv === null ? base : `${base} ${cv}`;
}

function researched(state: RunState, brief: Brief, off: boolean): string {
  const phrase = confirmedPhrase(state, brief);
  const head = phrase === null ? "No profile confirmed yet" : `Confirmed: ${phrase}`;
  if (off) return `${head}; role criteria were not checked because AI was off.`;
  const { rows, noun } = criteriaRows(brief);
  if (rows.length === 0) return `${head}.`;
  const evidenced = rows.filter((q) => q.coverage === "evidenced").length;
  const partial = rows.filter((q) => q.coverage === "partial").length;
  const partly = partial > 0 ? `, ${String(partial)} partly` : "";
  return `${head}; ${String(evidenced)} of ${String(rows.length)} ${noun} ${evidenced === 1 ? "has" : "have"} evidence${partly}.`;
}

/** Up to two gaps: criteria with no evidence first, then sources searched in vain, then sources not searched. */
function missing(state: RunState, brief: Brief, off: boolean): string {
  const textOf = new Map(state.questions.map((q) => [q.id, q.text]));
  const noEvidence = off
    ? []
    : criteriaRows(brief)
        .rows.filter((q) => q.coverage === "none")
        .map((q) => `no evidence for "${shorten(textOf.get(q.question_id) ?? q.question_id, 60)}"`);
  const label = (source: string): string => GAP_LABEL[source] ?? source;
  const empty = searchedEmpty(brief).map((g) => `nothing confirmed on ${label(g.source)}`);
  const notSearched = brief.not_searched.map((g) => `${label(g.source)} not searched`);
  const gaps = [...new Set([...noEvidence, ...empty, ...notSearched])].slice(0, 2);
  return gaps.length === 0 ? "Missing: no gaps recorded." : `Missing: ${gaps.join("; ")}.`;
}

/** A question is never cut short of being askable: it may run to ASK_MAX before the ellipsis. */
const ASK_MAX = 220;

/** Shortened text with its own end: "…" when cut, "?" for a question, "." otherwise. */
function sentence(text: string, max = MAX_PART): string {
  const short = shorten(text, max);
  if (short.endsWith("…")) return short;
  return `${short}${text.trim().endsWith("?") ? "?" : "."}`;
}

/** The first interview question (identity checks come first on a degraded brief), else the first to-verify item. */
function ask(brief: Brief): string {
  const question = brief.interview_questions.find((q) => q.trim() !== "");
  if (question !== undefined) return `Ask: ${sentence(question, ASK_MAX)}`;
  const check = brief.to_verify.find((t) => t.trim() !== "");
  if (check !== undefined) return `Check: ${sentence(check, ASK_MAX)}`;
  return "Ask: no interview question yet.";
}

/** The three sentences, or null while there is no brief. */
export function summary30s(state: RunState): Summary30s | null {
  const { brief } = state;
  if (brief === null) return null;
  const off = aiOff(brief);
  return { documented: documented(state, brief, off), missing: missing(state, brief, off), ask: ask(brief) };
}

/** One string for speech synthesis. */
export function summaryText(s: Summary30s): string {
  return [s.documented, s.missing, s.ask].join(" ");
}
