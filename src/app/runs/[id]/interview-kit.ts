/**
 * Interview kit: one Markdown document for the job interview, built from a finished brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/interview-kit.ts
 * Deps:    src/domain/challenge (type), ./call-panel (CallView, formatAt), ./code-profile-text, ./challenge, ./cv-check, ./export-text (EXPORT_DICT, exportText, toVerifyTexts), ./i18n (Report), ./report-text (tid), ./state (RunState, gap helpers, briefSections, confidenceBand, host)
 * Tested:  src/app/runs/[id]/__tests__/interview-kit.test.ts, src/app/runs/[id]/__tests__/export-text.test.ts (Czech kit), src/app/runs/[id]/__tests__/cv-check.test.ts (CV check)
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
 * - Code contributions (public GitHub): the github_deep numbers as a list (codeProfileLines), only when the run has them
 * - Czech kit (idea #24 follow-up): the same structure with the Czech fixed lines (EXPORT_DICT.cs) and the brief's
 *   translated texts by id (English per missing text); quotes, URLs, names and the headline stay original, one
 *   "(citace v originále)" header line when the kit shows a quote; kit-review.ts parses both languages
 * - kitFileName: interview-kit-<run id prefix>.md (-cs.md in Czech), never the candidate's name
 *
 * Design constraints:
 * - Pure; only data already in RunState goes in, never brief.also_found (unconfirmed namesake hits)
 * - The kit rates the research, never the candidate: no candidate scores, no verdicts; confidence is about the sources
 * - Every model or source text is Markdown-escaped; links only for http(s) URLs that parse
 * - Empty lists produce no heading
 */
import type { Brief, BriefSection, Claim } from "@/domain/claim";
import type { Challenge } from "@/domain/challenge";
import { type CallView, formatAt, placedCalls } from "./call-panel";
import { challengeReason, challengesById } from "./challenge";
import { codeProfileLines } from "./code-profile-text";
import { cvRows, isCvSection } from "./cv-check";
import { type ExportText, exportFileName, exportText, toVerifyTexts } from "./export-text";
import { ENGLISH_REPORT, type Report, type ReportLang } from "./i18n";
import { tid } from "./report-text";
import { GAP_LABEL, type RunState, briefSections, confidenceBand, gapText, hiringFor, host, namesakeOnly, searchedEmpty } from "./state";

/** One kit build: the language, and whether a quote was written (Czech then gets the "citace v originále" line). */
type Kit = { x: ExportText; quoted: boolean };

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

/** "2026-10-08" ("8. 10. 2026" in Czech) from an ISO timestamp; the raw (escaped) value when it does not parse. */
function day(iso: string, kit: Kit): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? escapeMd(iso) : kit.x.d.day(new Date(t).toISOString().slice(0, 10));
}

/** A "## title" block, or nothing when there are no lines. */
function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : [`## ${title}`, "", ...lines, ""];
}

function header(state: RunState, brief: Brief, generatedAt: string, kit: Kit): string[] {
  const { cost } = state;
  const { d, text } = kit.x;
  const hiring = hiringFor(state);
  const lines = [
    hiring !== null ? d.kit.hiringFor(escapeMd(hiring)) : null,
    brief.headline !== null ? d.kit.confirmedProfile(escapeMd(brief.headline)) : null,
    brief.location_note !== null ? escapeMd(text(tid.locationNote, brief.location_note)) : null,
    d.kit.generated(day(generatedAt, kit)),
    d.kit.research({ usd: cost.usd, sourceCalls: cost.source_calls, llmCalls: cost.llm_calls, durationMs: cost.duration_ms }),
    kit.quoted && d.kit.quotesNote !== "" ? d.kit.quotesNote : null,
  ].filter((l): l is string => l !== null);
  // Two trailing spaces: one line each in rendered Markdown.
  return [`# ${d.kit.title}`, "", ...lines.map((l, i) => (i < lines.length - 1 ? `${l}  ` : l)), ""];
}

type KitSource = RunState["sources"][number];

/**
 * "- FACT: text (<link>, <link>)" with only parseable http(s) links, then nested lines with the verbatim quote and,
 * per linked source, when it was retrieved.
 */
function claimLine(c: Claim, sourceOf: ReadonlyMap<string, KitSource>, challengeOf: ReadonlyMap<string, Challenge>, kit: Kit, label = ""): string {
  const { x } = kit;
  const linked = c.supports.flatMap((sid) => {
    const s = sourceOf.get(sid);
    const link = mdLink(s?.url ?? "");
    return s === undefined || link === null ? [] : [{ s, link }];
  });
  const hasQuote = c.quote !== null && c.quote.trim() !== "";
  if (hasQuote) kit.quoted = true;
  const quote = hasQuote ? `\n  - ${x.d.kit.quote}: "${escapeMd(c.quote ?? "")}"` : "";
  const retrieved = linked
    .filter(({ s }) => typeof s.fetched_at === "string")
    .map(({ s }) => `\n  - ${x.t.retrieved(s.fetched_at)} (${escapeMd(host(s.url))})`)
    .join("");
  const ch = challengeOf.get(c.id);
  const reason = ch === undefined ? "" : x.lang === "en" ? challengeReason(ch) : x.t.challengeReason(ch.ground, x.text(tid.challenge(c.id), ch.why));
  const challenged = ch === undefined ? "" : `\n  - ${escapeMd(reason)}`;
  return `- ${label === "" ? "" : `${escapeMd(label)} · `}${x.d.kit.kind[c.kind]}: ${escapeMd(x.text(tid.claim(c.id), c.text))}${linked.length > 0 ? ` (${linked.map((l) => l.link).join(", ")})` : ""}${challenged}${quote}${retrieved}`;
}

function coverage(state: RunState, brief: Brief, kit: Kit): string[] {
  const { d, text } = kit.x;
  const sourceOf = new Map(state.sources.map((s) => [s.id, s]));
  const challengeOf = challengesById(state);
  const textOf = new Map(state.questions.map((q) => [q.id, q.text]));
  const lines = brief.per_question.flatMap((q) => {
    const claims = state.claims.filter((c) => q.claim_ids.includes(c.id)).map((c) => claimLine(c, sourceOf, challengeOf, kit));
    const summary = escapeMd(text(tid.questionSummary(q.question_id), q.summary));
    return [
      `### ${escapeMd(text(tid.question(q.question_id), textOf.get(q.question_id) ?? q.question_id))}`,
      "",
      d.kit.coverage(q.coverage),
      ...(summary === "" ? [] : ["", summary]),
      ...(claims.length > 0 ? ["", ...claims] : []),
      "",
    ];
  });
  return lines.length === 0 ? [] : [`## ${d.kit.covered}`, "", ...lines];
}

/** Sections by confidence: how well the research backs each finding, facts before inferences, links for source-only sections. */
function findings(state: RunState, sections: readonly BriefSection[], kit: Kit): string[] {
  const { d, t, text } = kit.x;
  const sourceOf = new Map(state.sources.map((s) => [s.id, s]));
  const challengeOf = challengesById(state);
  const lines = sections.flatMap((sec) => {
    const claims = state.claims.filter((c) => sec.claim_ids.includes(c.id));
    const cv = isCvSection(sec.id) && claims.length > 0;
    const ordered = cv
      ? [t.cvExplainer, "", ...cvRows(claims, state.sources).map((r) => claimLine(r.claim, sourceOf, challengeOf, kit, t.cvOutcome[r.outcome]))]
      : [...claims.filter((c) => c.kind !== "INFERENCE"), ...claims.filter((c) => c.kind === "INFERENCE")].map((c) => claimLine(c, sourceOf, challengeOf, kit));
    const links = claims.length === 0 ? [...new Set(sec.source_ids.flatMap((sid) => mdLink(sourceOf.get(sid)?.url ?? "") ?? []))].map((l) => `- ${l}`) : [];
    const summary = escapeMd(text(tid.sectionSummary(sec.id), sec.summary));
    return [
      `### ${escapeMd(text(tid.sectionTitle(sec.id), sec.title))}`,
      "",
      d.kit.confidence(Math.round(sec.confidence * 100), confidenceBand(sec.confidence), escapeMd(text(tid.sectionReason(sec.id), sec.confidence_reason))),
      ...(summary === "" ? [] : ["", summary]),
      ...(ordered.length + links.length > 0 ? ["", ...ordered, ...links] : []),
      "",
    ];
  });
  return [`## ${d.kit.found}`, "", ...lines];
}

function degradedCoverage(state: RunState, brief: Brief, reason: string, kit: Kit): string[] {
  const { d, t, text } = kit.x;
  const criteria = state.questions.filter((q) => q.id.startsWith("mh-")).map((q) => `- ${escapeMd(text(tid.question(q.id), q.text))}`);
  const evidence = brief.evidence.flatMap((e) => {
    const link = mdLink(e.url);
    return link === null ? [] : [`- ${escapeMd(e.excerpt)} (${link})`];
  });
  if (evidence.length > 0) kit.quoted = true;
  return [
    `## ${d.kit.covered}`,
    "",
    d.kit.aiUnavailable(escapeMd(text(tid.degraded, reason))),
    "",
    ...(criteria.length > 0 ? [`### ${d.kit.roleCriteria}`, "", ...criteria, ""] : []),
    ...(evidence.length > 0 ? [`### ${t.fromConfirmed}`, "", ...evidence, ""] : []),
  ];
}

/** One line per question of the latest call that has answers; nothing without one. */
function phoneLines(calls: readonly CallView[], kit: Kit): string[] {
  const { d } = kit.x;
  const call = placedCalls(calls).find((c) => c.answers !== null && c.answers.length > 0);
  const answers = call?.answers ?? [];
  if (call === undefined || answers.length === 0) return [];
  const lines = answers.map((a) => {
    const label = d.kit.answer[a.status];
    if (a.status === "answered" && a.summary !== null && a.quote !== null) {
      kit.quoted = true;
      const at = a.at_secs === null ? "" : ` (${d.kit.at(formatAt(a.at_secs))})`;
      return `- ${label}: ${escapeMd(a.summary)} — "${escapeMd(a.quote)}"${at}`;
    }
    if (a.status === "unclear" && a.summary !== null) return `- ${label}: ${escapeMd(a.summary)}`;
    return `- ${label}: ${escapeMd(a.question)}`;
  });
  return call.provider === "mock" ? [...lines, "", `_${d.kit.mock}_`] : lines;
}

/** "- [ ] item" per to-verify item, a nested reason under challenged ones, then the devil's advocate line (idea #8). */
function toVerifyLines(state: RunState, brief: Brief, kit: Kit): string[] {
  const items = toVerifyTexts(state, brief, kit.x);
  if (items.length === 0) return [];
  const line = kit.x.t.devilsAdvocate(state.challenge_summary);
  return [
    ...items.map((i) => `- [ ] ${escapeMd(i.text)}${i.reason === null ? "" : `\n  - ${escapeMd(i.reason)}`}`),
    ...(line === null ? [] : ["", `_${escapeMd(line)}_`]),
  ];
}

/** "LinkedIn: no public profile" in the export language: generic labels translated, the reason by its brief id. */
function gapItem(g: Brief["not_searched"][number], id: string, kit: Kit): string {
  const { t, text } = kit.x;
  return `- ${escapeMd(`${t.label(GAP_LABEL[g.source] ?? g.source)}: ${text(id, gapText(g.reason))}`)}`;
}

/**
 * The interview kit as Markdown, or null while there is no brief. `generatedAt` is an ISO timestamp. `report` is the
 * report language with the brief's cached translation (makeReport); English by default.
 */
export function interviewKit(state: RunState, generatedAt: string, calls: readonly CallView[] = [], report: Report = ENGLISH_REPORT): string | null {
  const { brief } = state;
  if (brief === null) return null;
  const kit: Kit = { x: exportText(report), quoted: false };
  const { d, t, text } = kit.x;
  const empty = searchedEmpty(brief);
  const sections = briefSections(brief);
  const footer = [`_${d.kit.footer}_`];
  if (brief.removed_protected > 0) footer.push(`_${d.kit.removed(brief.removed_protected)}_`);
  // The body first, so the header knows whether a quote was written.
  const body = [
    ...(brief.degraded !== null ? degradedCoverage(state, brief, brief.degraded, kit) : []),
    ...(sections !== null ? findings(state, sections, kit) : brief.degraded === null ? coverage(state, brief, kit) : []),
    ...section(
      d.kit.questions,
      brief.interview_questions.flatMap((q, i) => [`- [ ] ${escapeMd(text(tid.interviewQuestion(i), q))}`, `  ${d.kit.notes}`]),
    ),
    ...section(t.toVerify, toVerifyLines(state, brief, kit)),
    ...section(t.searched(namesakeOnly(empty)), empty.map((g, i) => gapItem(g, tid.searchedEmpty(i), kit))),
    ...section(t.notSearched, brief.not_searched.map((g, i) => gapItem(g, tid.notSearched(i), kit))),
    ...section(d.kit.codeProfile, codeProfileLines(state.code_profile ?? null).map((l) => (l.startsWith("- ") ? l : `- ${escapeMd(l)}`))),
    ...section(d.kit.phone, phoneLines(calls, kit)),
  ];
  const lines = [...header(state, brief, generatedAt, kit), ...body, "---", "", footer.join("  \n")];
  return `${lines.join("\n")}\n`;
}

/** Download name: the run id prefix only, so the candidate's name never lands in a file name; "-cs" for Czech. */
export function kitFileName(state: Pick<RunState, "id">, lang: ReportLang = "en"): string {
  return exportFileName(`interview-kit-${state.id.slice(0, 8)}.md`, lang);
}
