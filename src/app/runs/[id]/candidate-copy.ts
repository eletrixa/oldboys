/**
 * Candidate notice: a plain, polite Markdown text the recruiter can send to the researched person (GDPR: informed).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/candidate-copy.ts
 * Deps:    src/domain/scrub, ./interview-kit (escapeMd, mdLink), ./state (RunState, gap helpers, labels), ./candidate-copy-cs
 * Tested:  src/app/runs/[id]/__tests__/candidate-copy.test.ts
 *
 * Key responsibilities:
 * - candidateCopy: who researches (the recruiter's organization when known) and why (role), sources searched and not searched (with scrubbed reasons), links confirmed
 *   as the person's, what the research is used for, "rates the evidence, never you", deletion date, how to object
 * - Two languages (NoticeLang "en" | "cs", idea #24 part): one NoticeText table per language, same sections and logic;
 *   the Czech table lives in candidate-copy-cs.ts
 * - noticeFileName: candidate-notice-<run id prefix>.md (en) or -cs.md (cs), never the candidate's name
 *
 * Design constraints:
 * - Pure; built from RunState only. Never claims, summaries, interview questions, to-verify items, cost,
 *   brief.also_found (unconfirmed namesake hits) or excerpts: links and source names only
 * - Every model or source text is Markdown-escaped; links only for http(s) URLs that parse
 * - "Not searched" reasons pass scrubReason first: no request URLs, e-mails or phone numbers reach the candidate
 */
import type { Brief } from "@/domain/claim";
import { scrubReason } from "@/domain/scrub";
import { escapeMd, mdLink } from "./interview-kit";
import { CS_TEXT } from "./candidate-copy-cs";
import { GAP_LABEL, PLATFORM_LABEL, type RunState, evidenceGroup, gapText, searchedEmpty } from "./state";

const RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-15" = created_at + 7 days; null when created_at does not parse. */
function deletionDay(createdAt: string): string | null {
  const t = Date.parse(createdAt);
  return Number.isNaN(t) ? null : new Date(t + RETENTION_DAYS * DAY_MS).toISOString().slice(0, 10);
}

/** Confirmed links: profiles the recruiter merged in the lineup, then confirmed evidence pages; http(s) only, deduped. */
function confirmedLinks(state: RunState, brief: Brief): string[] {
  const urls = [
    ...state.candidates.filter((c) => c.decision === "merge").flatMap((c) => c.profile_urls),
    ...brief.evidence.map((e) => e.url),
  ];
  const links = urls.flatMap((u) => {
    const link = mdLink(u);
    return link === null ? [] : [link];
  });
  return [...new Set(links)];
}

/** Fixed strings of one notice language; role is the escaped role name or null, label and reason translate source text. */
export type NoticeText = {
  title: string;
  greeting: (subject: string) => string;
  /** org is the recruiter's organization name (escaped) or null for the anonymous wording. */
  intro: (role: string | null, org: string | null) => string;
  whyHeading: string;
  why: (role: string | null) => string;
  doesHeading: string;
  does: (org: string | null) => readonly string[];
  searchedHeading: string;
  emptySuffix: string;
  notSearchedHeading: string;
  confirmedHeading: string;
  noneConfirmed: string;
  notYou: string;
  keepHeading: string;
  /** day: "YYYY-MM-DD" or null when created_at does not parse. */
  keep: (day: string | null, days: number) => string;
  rightsHeading: string;
  rights: string;
  reply: string;
  closing: (org: string | null) => readonly string[];
  /** English source label (GAP_LABEL / evidenceGroup) → this language. */
  label: (label: string) => string;
  /** Scrubbed raw gap reason → plain words in this language. */
  reason: (scrubbed: string) => string;
};

export type NoticeLang = "en" | "cs";

/** "the hiring team at Acme" when the run has an organization, else the anonymous wording. */
function enTeam(org: string | null): string {
  return org !== null ? `the hiring team at ${org}` : "our hiring team";
}

const EN_TEXT: NoticeText = {
  title: "How we looked at your public profiles",
  greeting: (subject) => `Hello ${subject},`,
  intro: (role, org) =>
    `Thank you for your interest in ${role !== null ? `the ${role} role` : "the role you applied for"}. As part of the hiring ` +
    `process, ${enTeam(org)} looked at public information about you. We want you to know what we looked at and why.`,
  whyHeading: "Why",
  why: (role) =>
    `We are hiring for ${role !== null ? `the ${role} role` : "the role you applied for"}. The research helps us prepare good ` +
    "questions for the interview and see which parts of your public work relate to the role.",
  doesHeading: "What the research does and does not do",
  does: (org) => [
    "- It uses public sources only. No private messages, closed groups or logins.",
    "- It rates the research itself: how much public evidence it found and how good that evidence is. It never rates you as a person.",
    "- It does not look at health, political views, religion, ethnicity, sexual orientation or similar sensitive topics.",
    `- No decision is made by the research alone; people in ${enTeam(org)} make every decision.`,
  ],
  searchedHeading: "Public sources we searched",
  emptySuffix: "(nothing found that we could confirm as yours)",
  notSearchedHeading: "Sources we did not search, and why",
  confirmedHeading: "Public profiles and pages we confirmed as yours",
  noneConfirmed: "We did not confirm any public profile as yours.",
  notYou: "If any of these is not you, please tell us and we will remove it.",
  keepHeading: "How long we keep it",
  keep: (day, days) =>
    day !== null
      ? `All research data is deleted on ${day} (${String(days)} days after the research).`
      : `All research data is deleted ${String(days)} days after the research.`,
  rightsHeading: "Your rights",
  rights: "You can ask us what we found, ask us to correct something, or ask us to delete it now.",
  reply: "Reply to this email",
  closing: (org) => ["Kind regards,  ", org !== null ? `The hiring team at ${org}` : "The hiring team"],
  label: (label) => label,
  reason: gapText,
};

const TEXT: Record<NoticeLang, NoticeText> = { en: EN_TEXT, cs: CS_TEXT };

/** Source names that returned something confirmed, then the ones searched with nothing confirmed. */
function searchedLines(state: RunState, brief: Brief, t: NoticeText): string[] {
  const found = new Set([
    ...state.candidates.filter((c) => c.decision === "merge").map((c) => PLATFORM_LABEL[c.platform] ?? "Web search"),
    ...brief.evidence.map((e) => evidenceGroup(e)),
  ]);
  const empty = searchedEmpty(brief)
    .map((g) => GAP_LABEL[g.source] ?? g.source)
    .filter((label) => !found.has(label));
  return [
    ...[...found].map((label) => `- ${escapeMd(t.label(label))}`),
    ...[...new Set(empty)].map((label) => `- ${escapeMd(t.label(label))} ${t.emptySuffix}`),
  ];
}

/** "LinkedIn: no public profile" — label and scrubbed reason in the notice language. */
function notSearchedLine(g: Brief["not_searched"][number], t: NoticeText): string {
  return `- ${escapeMd(`${t.label(GAP_LABEL[g.source] ?? g.source)}: ${t.reason(scrubReason(g.reason))}`)}`;
}

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : [`## ${title}`, "", ...lines, ""];
}

/** The candidate notice as Markdown in `lang`, or null while there is no brief (sources are not known yet). */
export function candidateCopy(state: RunState, lang: NoticeLang = "en"): string | null {
  const { brief } = state;
  if (brief === null) return null;
  const t = TEXT[lang];
  const role = state.role !== null && state.role.trim() !== "" ? escapeMd(state.role) : null;
  const org = state.organization_name !== null ? escapeMd(state.organization_name) : null;
  const links = confirmedLinks(state, brief);
  const lines = [
    `# ${t.title}`,
    "",
    t.greeting(escapeMd(state.subject)),
    "",
    t.intro(role, org),
    "",
    `## ${t.whyHeading}`,
    "",
    t.why(role),
    "",
    `## ${t.doesHeading}`,
    "",
    ...t.does(org),
    "",
    ...section(t.searchedHeading, searchedLines(state, brief, t)),
    ...section(t.notSearchedHeading, brief.not_searched.map((g) => notSearchedLine(g, t))),
    `## ${t.confirmedHeading}`,
    "",
    ...(links.length > 0 ? links.map((l) => `- ${l}`) : [t.noneConfirmed]),
    "",
    t.notYou,
    "",
    `## ${t.keepHeading}`,
    "",
    t.keep(deletionDay(state.created_at), RETENTION_DAYS),
    "",
    `## ${t.rightsHeading}`,
    "",
    t.rights,
    "",
    t.reply,
    "",
    ...t.closing(org),
  ];
  return `${lines.join("\n")}\n`;
}

/** Download name: the run id prefix only, so the candidate's name never lands in a file name. */
export function noticeFileName(state: Pick<RunState, "id">, lang: NoticeLang = "en"): string {
  return `candidate-notice-${state.id.slice(0, 8)}${lang === "cs" ? "-cs" : ""}.md`;
}
