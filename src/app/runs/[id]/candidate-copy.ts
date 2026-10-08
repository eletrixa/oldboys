/**
 * Candidate notice: a plain, polite Markdown text the recruiter can send to the researched person (GDPR: informed).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/candidate-copy.ts
 * Deps:    src/domain/scrub, ./interview-kit (escapeMd, mdLink), ./state (RunState, gap helpers, labels)
 * Tested:  src/app/runs/[id]/__tests__/candidate-copy.test.ts
 *
 * Key responsibilities:
 * - candidateCopy: who researches and why (role), sources searched and not searched (with scrubbed reasons), links confirmed
 *   as the person's, what the research is used for, "rates the evidence, never you", deletion date, how to object
 * - noticeFileName: candidate-notice-<run id prefix>.md, never the candidate's name
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
import { GAP_LABEL, PLATFORM_LABEL, type RunState, evidenceGroup, gapLine, searchedEmpty } from "./state";

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

/** Source names that returned something confirmed, then the ones searched with nothing confirmed. */
function searchedLines(state: RunState, brief: Brief): string[] {
  const found = new Set([
    ...state.candidates.filter((c) => c.decision === "merge").map((c) => PLATFORM_LABEL[c.platform] ?? "Web search"),
    ...brief.evidence.map((e) => evidenceGroup(e)),
  ]);
  const empty = searchedEmpty(brief)
    .map((g) => GAP_LABEL[g.source] ?? g.source)
    .filter((label) => !found.has(label));
  return [
    ...[...found].map((label) => `- ${escapeMd(label)}`),
    ...[...new Set(empty)].map((label) => `- ${escapeMd(label)} (nothing found that we could confirm as yours)`),
  ];
}

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : [`## ${title}`, "", ...lines, ""];
}

/** The candidate notice as Markdown, or null while there is no brief (sources are not known yet). */
export function candidateCopy(state: RunState): string | null {
  const { brief } = state;
  if (brief === null) return null;
  const role = state.role !== null && state.role.trim() !== "" ? `the ${escapeMd(state.role)} role` : "the role you applied for";
  const deleteOn = deletionDay(state.created_at);
  const links = confirmedLinks(state, brief);
  const lines = [
    "# How we looked at your public profiles",
    "",
    `Hello ${escapeMd(state.subject)},`,
    "",
    `Thank you for your interest in ${role}. As part of the hiring process, our hiring team looked at public ` +
      "information about you. We want you to know what we looked at and why.",
    "",
    "## Why",
    "",
    `We are hiring for ${role}. The research helps us prepare good questions for the interview and see which ` +
      "parts of your public work relate to the role.",
    "",
    "## What the research does and does not do",
    "",
    "- It uses public sources only. No private messages, closed groups or logins.",
    "- It rates the research itself: how much public evidence it found and how good that evidence is. It never rates you as a person.",
    "- It does not look at health, political views, religion, ethnicity, sexual orientation or similar sensitive topics.",
    "- No decision is made by the research alone; people in our hiring team make every decision.",
    "",
    ...section("Public sources we searched", searchedLines(state, brief)),
    ...section("Sources we did not search, and why", brief.not_searched.map((g) => `- ${escapeMd(gapLine({ ...g, reason: scrubReason(g.reason) }))}`)),
    "## Public profiles and pages we confirmed as yours",
    "",
    ...(links.length > 0 ? links.map((l) => `- ${l}`) : ["We did not confirm any public profile as yours."]),
    "",
    "If any of these is not you, please tell us and we will remove it.",
    "",
    "## How long we keep it",
    "",
    deleteOn !== null
      ? `All research data is deleted on ${deleteOn} (${String(RETENTION_DAYS)} days after the research).`
      : `All research data is deleted ${String(RETENTION_DAYS)} days after the research.`,
    "",
    "## Your rights",
    "",
    "You can ask us what we found, ask us to correct something, or ask us to delete it now.",
    "",
    "Reply to this email",
    "",
    "Kind regards,  ",
    "The hiring team",
  ];
  return `${lines.join("\n")}\n`;
}

/** Download name: the run id prefix only, so the candidate's name never lands in a file name. */
export function noticeFileName(state: Pick<RunState, "id">): string {
  return `candidate-notice-${state.id.slice(0, 8)}.md`;
}
