/**
 * Interview kit: one Markdown document for the job interview, built from a finished brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/interview-kit.ts
 * Deps:    src/domain/run-cost (formatDuration), ./state (RunState, gap helpers, roleCriteria, briefSections, confidenceBand)
 * Tested:  src/app/runs/[id]/__tests__/interview-kit.test.ts
 *
 * Key responsibilities:
 * - interviewKit: header (role, or the position title when the run has one, confirmed profile, date, research cost), coverage per question with sourced claims,
 *   interview questions as a checklist with room for notes, to-verify list, gap lists, footer
 * - Findings by section (confidence descending, with the reason) replace per-question coverage; briefs stored
 *   before sections fall back to coverage
 * - Degraded brief: the "AI summary unavailable" note, role criteria and confirmed evidence links, then the sections
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
import { type RunState, briefSections, confidenceBand, gapLine, roleCriteria, searchedEmpty, searchedTitle } from "./state";

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
  const hiringFor = state.position?.title ?? state.role;
  const lines = [
    hiringFor !== null ? `Hiring for: ${escapeMd(hiringFor)}` : null,
    brief.headline !== null ? `Confirmed profile: ${escapeMd(brief.headline)}` : null,
    brief.location_note !== null ? escapeMd(brief.location_note) : null,
    `Generated: ${day(generatedAt)}`,
    `Research: $${cost.usd.toFixed(2)} · ${plural(cost.source_calls, "source call")} · ${plural(cost.llm_calls, "AI call")} · ${formatDuration(cost.duration_ms)}`,
  ].filter((l): l is string => l !== null);
  // Two trailing spaces: one line each in rendered Markdown.
  return ["# Interview kit", "", ...lines.map((l, i) => (i < lines.length - 1 ? `${l}  ` : l)), ""];
}

/** "- FACT: text (<link>, <link>)" with only parseable http(s) links. */
function claimLine(c: Claim, urlOf: ReadonlyMap<string, string>): string {
  const links = c.supports.flatMap((sid) => {
    const link = mdLink(urlOf.get(sid) ?? "");
    return link === null ? [] : [link];
  });
  return `- ${c.kind}: ${escapeMd(c.text)}${links.length > 0 ? ` (${links.join(", ")})` : ""}`;
}

function coverage(state: RunState, brief: Brief): string[] {
  const urlOf = new Map(state.sources.map((s) => [s.id, s.url]));
  const textOf = new Map(state.questions.map((q) => [q.id, q.text]));
  const lines = brief.per_question.flatMap((q) => {
    const claims = state.claims.filter((c) => q.claim_ids.includes(c.id)).map((c) => claimLine(c, urlOf));
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
  const urlOf = new Map(state.sources.map((s) => [s.id, s.url]));
  const lines = sections.flatMap((sec) => {
    const claims = state.claims.filter((c) => sec.claim_ids.includes(c.id));
    const ordered = [...claims.filter((c) => c.kind !== "INFERENCE"), ...claims.filter((c) => c.kind === "INFERENCE")].map((c) => claimLine(c, urlOf));
    const links = claims.length === 0 ? [...new Set(sec.source_ids.flatMap((sid) => mdLink(urlOf.get(sid) ?? "") ?? []))].map((l) => `- ${l}`) : [];
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

/** The interview kit as Markdown, or null while there is no brief. `generatedAt` is an ISO timestamp. */
export function interviewKit(state: RunState, generatedAt: string): string | null {
  const { brief } = state;
  if (brief === null) return null;
  const empty = searchedEmpty(brief);
  const sections = briefSections(brief);
  const footer = [`_${FOOTER}_`];
  if (brief.removed_protected > 0) footer.push(`_${String(brief.removed_protected)} items removed (protected categories)_`);
  const lines = [
    ...header(state, brief, generatedAt),
    ...(brief.degraded !== null ? degradedCoverage(state, brief, brief.degraded) : []),
    ...(sections !== null ? findings(state, sections) : brief.degraded === null ? coverage(state, brief) : []),
    ...section(
      "Questions for the interview",
      brief.interview_questions.flatMap((q) => [`- [ ] ${escapeMd(q)}`, "  Notes:"]),
    ),
    ...section("To verify", brief.to_verify.map((t) => `- [ ] ${escapeMd(t)}`)),
    ...section(searchedTitle(empty), empty.map((g) => `- ${escapeMd(gapLine(g))}`)),
    ...section("Not searched, and why", brief.not_searched.map((g) => `- ${escapeMd(gapLine(g))}`)),
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
