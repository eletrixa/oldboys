/**
 * Interview kit: one Markdown document for the job interview, built from a finished brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/interview-kit.ts
 * Deps:    src/domain/run-cost (formatDuration), src/domain/challenge (type), ./call-panel (CallView, formatAt), ./challenge, ./cv-check, ./evidence (retrievedLabel), ./state (RunState, gap helpers, roleCriteria, briefSections, confidenceBand, host)
 * Tested:  src/app/runs/[id]/__tests__/interview-kit.test.ts, src/app/runs/[id]/__tests__/cv-check.test.ts (CV check)
 *
 * Key responsibilities:
 * - interviewKit: header (role, or the position title when the run has one, confirmed profile, date, research cost), coverage per question with sourced claims
 *   (each with its verbatim quote and the retrieval date per linked source, idea #5),
 *   interview questions as a checklist with room for notes, to-verify list, gap lists, footer
 * - Findings by section (confidence descending, with the reason) replace per-question coverage; briefs stored
 *   before sections fall back to coverage
 * - Devil's advocate (idea #8): a challenged claim gets a nested "Challenged: … (reason)" line; to-verify items carry the
 *   same reason (toVerifyItems) and the list ends with the "Devil's advocate: checked N findings, …" line
 * - "CV vs public record" (idea #14): the explainer line, claims in outcome order, each line led by its outcome label
 * - Degraded brief: the "AI summary unavailable" note, role criteria and confirmed evidence links, then the sections
 * - Phone verification: the latest call with answers, one line per question, labelled as said by the candidate
 *   (never public evidence); without calls the kit is unchanged
 * - kitFileName: interview-kit-<run id prefix>.md, never the candidate's name
 *
 * Design constraints:
 * - Pure; only data already in RunState goes in, never brief.also_found (unconfirmed namesake hits)
 * - The kit rates the research, never the candidate: no candidate scores, no verdicts; confidence is about the sources
 * - Every model or source text is Markdown-escaped; links only for http(s) URLs that parse
 * - Empty lists produce no heading
 */
import { formatDuration } from "@/domain/run-cost";
import type { Brief, BriefSection, Claim } from "@/domain/claim";
import type { Challenge } from "@/domain/challenge";
import { ANSWER_BADGE, type CallView, formatAt, placedCalls } from "./call-panel";
import { challengeLine, challengeReason, challengesById, toVerifyItems } from "./challenge";
import { CV_EXPLAINER, CV_OUTCOME, cvRows, isCvSection } from "./cv-check";
import { retrievedLabel } from "./evidence";
import { type RunState, briefSections, confidenceBand, gapLine, hiringFor, host, roleCriteria, searchedEmpty, searchedTitle } from "./state";

const FOOTER = "This kit rates the research, never the candidate. Public sources only; run data is deleted after 7 days.";

/** Escapes Markdown specials and collapses newlines, so model or source text can never add structure or links. */
export function escapeMd(text: string): string {
  return text
    .replace(/\s*[\r\n]+\s*/g, " ")
    .replace(/[\\`*_[\]<>#|]/g, (c) => `\\${c}`)
    .trim();
}

/** `<url>` for a parseable http(s) URL, null otherwise (javascript:, data:, garbage). */
export function mdLink(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? `<${u.href}>` : null;
  } catch {
    return null;
  }
}

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

/** "2026-10-08" from an ISO timestamp; the raw (escaped) value when it does not parse. */
function day(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? escapeMd(iso) : new Date(t).toISOString().slice(0, 10);
}

/** A "## title" block, or nothing when there are no lines. */
function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : [`## ${title}`, "", ...lines, ""];
}

function header(state: RunState, brief: Brief, generatedAt: string): string[] {
  const { cost } = state;
  const hiring = hiringFor(state);
  const lines = [
    hiring !== null ? `Hiring for: ${escapeMd(hiring)}` : null,
    brief.headline !== null ? `Confirmed profile: ${escapeMd(brief.headline)}` : null,
    brief.location_note !== null ? escapeMd(brief.location_note) : null,
    `Generated: ${day(generatedAt)}`,
    `Research: $${cost.usd.toFixed(2)} · ${plural(cost.source_calls, "source call")} · ${plural(cost.llm_calls, "AI call")} · ${formatDuration(cost.duration_ms)}`,
  ].filter((l): l is string => l !== null);
  // Two trailing spaces: one line each in rendered Markdown.
  return ["# Interview kit", "", ...lines.map((l, i) => (i < lines.length - 1 ? `${l}  ` : l)), ""];
}

type KitSource = RunState["sources"][number];

/**
 * "- FACT: text (<link>, <link>)" with only parseable http(s) links, then nested lines with the verbatim quote and,
 * per linked source, when it was retrieved.
 */
function claimLine(c: Claim, sourceOf: ReadonlyMap<string, KitSource>, challengeOf: ReadonlyMap<string, Challenge>, label = ""): string {
  const linked = c.supports.flatMap((sid) => {
    const s = sourceOf.get(sid);
    const link = mdLink(s?.url ?? "");
    return s === undefined || link === null ? [] : [{ s, link }];
  });
  const quote = c.quote !== null && c.quote.trim() !== "" ? `\n  - Quote: "${escapeMd(c.quote)}"` : "";
  const retrieved = linked
    .filter(({ s }) => typeof s.fetched_at === "string")
    .map(({ s }) => `\n  - ${retrievedLabel(s.fetched_at)} (${escapeMd(host(s.url))})`)
    .join("");
  const ch = challengeOf.get(c.id);
  const challenged = ch === undefined ? "" : `\n  - ${escapeMd(challengeReason(ch))}`;
  return `- ${label === "" ? "" : `${escapeMd(label)} · `}${c.kind}: ${escapeMd(c.text)}${linked.length > 0 ? ` (${linked.map((l) => l.link).join(", ")})` : ""}${challenged}${quote}${retrieved}`;
}

function coverage(state: RunState, brief: Brief): string[] {
  const sourceOf = new Map(state.sources.map((s) => [s.id, s]));
  const challengeOf = challengesById(state);
  const textOf = new Map(state.questions.map((q) => [q.id, q.text]));
  const lines = brief.per_question.flatMap((q) => {
    const claims = state.claims.filter((c) => q.claim_ids.includes(c.id)).map((c) => claimLine(c, sourceOf, challengeOf));
    const summary = escapeMd(q.summary);
    return [
      `### ${escapeMd(textOf.get(q.question_id) ?? q.question_id)}`,
      "",
      `Coverage: ${q.coverage}`,
      ...(summary === "" ? [] : ["", summary]),
      ...(claims.length > 0 ? ["", ...claims] : []),
      "",
    ];
  });
  return lines.length === 0 ? [] : ["## What the research covered", "", ...lines];
}

/** Sections by confidence: how well the research backs each finding, facts before inferences, links for source-only sections. */
function findings(state: RunState, sections: readonly BriefSection[]): string[] {
  const sourceOf = new Map(state.sources.map((s) => [s.id, s]));
  const challengeOf = challengesById(state);
  const lines = sections.flatMap((sec) => {
    const claims = state.claims.filter((c) => sec.claim_ids.includes(c.id));
    const cv = isCvSection(sec.id) && claims.length > 0;
    const ordered = cv
      ? [CV_EXPLAINER, "", ...cvRows(claims, state.sources).map((r) => claimLine(r.claim, sourceOf, challengeOf, CV_OUTCOME[r.outcome].label))]
      : [...claims.filter((c) => c.kind !== "INFERENCE"), ...claims.filter((c) => c.kind === "INFERENCE")].map((c) => claimLine(c, sourceOf, challengeOf));
    const links = claims.length === 0 ? [...new Set(sec.source_ids.flatMap((sid) => mdLink(sourceOf.get(sid)?.url ?? "") ?? []))].map((l) => `- ${l}`) : [];
    const summary = escapeMd(sec.summary);
    return [
      `### ${escapeMd(sec.title)}`,
      "",
      `Research confidence: ${String(Math.round(sec.confidence * 100))}% (${confidenceBand(sec.confidence)}), ${escapeMd(sec.confidence_reason)}`,
      ...(summary === "" ? [] : ["", summary]),
      ...(ordered.length + links.length > 0 ? ["", ...ordered, ...links] : []),
      "",
    ];
  });
  return ["## What the research found", "", ...lines];
}

function degradedCoverage(state: RunState, brief: Brief, reason: string): string[] {
  const criteria = roleCriteria(state.questions).map((t) => `- ${escapeMd(t)}`);
  const evidence = brief.evidence.flatMap((e) => {
    const link = mdLink(e.url);
    return link === null ? [] : [`- ${escapeMd(e.excerpt)} (${link})`];
  });
  return [
    "## What the research covered",
    "",
    `AI summary unavailable: ${escapeMd(reason)}`,
    "",
    ...(criteria.length > 0 ? ["### Role criteria (not checked)", "", ...criteria, ""] : []),
    ...(evidence.length > 0 ? ["### From profiles you confirmed", "", ...evidence, ""] : []),
  ];
}

/** One line per question of the latest call that has answers; nothing without one. */
function phoneLines(calls: readonly CallView[]): string[] {
  const call = placedCalls(calls).find((c) => c.answers !== null && c.answers.length > 0);
  const answers = call?.answers ?? [];
  if (call === undefined || answers.length === 0) return [];
  const lines = answers.map((a) => {
    const { label } = ANSWER_BADGE[a.status];
    if (a.status === "answered" && a.summary !== null && a.quote !== null) {
      const at = a.at_secs === null ? "" : ` (at ${formatAt(a.at_secs)})`;
      return `- ${label}: ${escapeMd(a.summary)} — "${escapeMd(a.quote)}"${at}`;
    }
    if (a.status === "unclear" && a.summary !== null) return `- ${label}: ${escapeMd(a.summary)}`;
    return `- ${label}: ${escapeMd(a.question)}`;
  });
  return call.provider === "mock" ? [...lines, "", "_MOCK call: the answers are simulated._"] : lines;
}

/** "- [ ] item" per to-verify item, a nested reason under challenged ones, then the devil's advocate line (idea #8). */
function toVerifyLines(state: RunState, brief: Brief): string[] {
  const items = toVerifyItems(brief, state.claims, challengesById(state));
  if (items.length === 0) return [];
  const line = challengeLine(state.challenge_summary);
  return [
    ...items.map((i) => `- [ ] ${escapeMd(i.text)}${i.reason === null ? "" : `\n  - ${escapeMd(i.reason)}`}`),
    ...(line === null ? [] : ["", `_${escapeMd(line)}_`]),
  ];
}

/** The interview kit as Markdown, or null while there is no brief. `generatedAt` is an ISO timestamp. */
export function interviewKit(state: RunState, generatedAt: string, calls: readonly CallView[] = []): string | null {
  const { brief } = state;
  if (brief === null) return null;
  const empty = searchedEmpty(brief);
  const sections = briefSections(brief);
  const footer = [`_${FOOTER}_`];
  if (brief.removed_protected > 0) footer.push(`_${plural(brief.removed_protected, "item")} removed (protected categories)_`);
  const lines = [
    ...header(state, brief, generatedAt),
    ...(brief.degraded !== null ? degradedCoverage(state, brief, brief.degraded) : []),
    ...(sections !== null ? findings(state, sections) : brief.degraded === null ? coverage(state, brief) : []),
    ...section(
      "Questions for the interview",
      brief.interview_questions.flatMap((q) => [`- [ ] ${escapeMd(q)}`, "  Notes:"]),
    ),
    ...section("To verify", toVerifyLines(state, brief)),
    ...section(searchedTitle(empty), empty.map((g) => `- ${escapeMd(gapLine(g))}`)),
    ...section("Not searched, and why", brief.not_searched.map((g) => `- ${escapeMd(gapLine(g))}`)),
    ...section("Phone verification (said by the candidate, not public evidence)", phoneLines(calls)),
    "---",
    "",
    footer.join("  \n"),
  ];
  return `${lines.join("\n")}\n`;
}

/** Download name: the run id prefix only, so the candidate's name never lands in a file name. */
export function kitFileName(state: Pick<RunState, "id">): string {
  return `interview-kit-${state.id.slice(0, 8)}.md`;
}
