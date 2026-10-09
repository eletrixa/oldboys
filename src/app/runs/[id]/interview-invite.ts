/**
 * "Add interview to calendar": an RFC 5545 invite (.ics) with the brief inside, for any calendar (idea #22).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/interview-invite.ts
 * Deps:    src/domain/audit (deletionDate), ./summary (summary30s), ./state (RunState, hiringFor), ./export-text (EXPORT_DICT, localSummary), ./i18n (Report)
 * Tested:  src/app/runs/[id]/__tests__/interview-invite.test.ts, src/app/runs/[id]/__tests__/export-text.test.ts (Czech invite)
 *
 * Key responsibilities:
 * - interviewInvite: one VEVENT (UTC times) whose description carries the three 30-second summary lines, up to 8
 *   interview questions, up to 5 to-verify items, the link to the full brief and the footer, or null without a brief
 * - Czech invite (idea #24 follow-up): SUMMARY and DESCRIPTION carry LANGUAGE=cs, Czech fixed lines, questions,
 *   to-verify items and summary sentences by their brief ids (English per missing one), Czech deletion date
 * - inviteFileName: interview-<run id prefix>.ics (-cs.ics in Czech), never the candidate's name
 *
 * Design constraints:
 * - Pure and deterministic; RFC 5545: CRLF line ends, TEXT escaping, lines folded at 75 octets without splitting a
 *   UTF-8 character (Czech diacritics)
 * - No attendees (the recruiter adds the interviewers in the calendar); no also_found, unconfirmed or rejected
 *   candidates, claims, excerpts or cost
 * - Rates the research, never the candidate: no scores, ranks, verdicts or traits
 */
import { deletionDate } from "@/domain/audit";
import { exportFileName, exportText, localSummary } from "./export-text";
import { ENGLISH_REPORT, type Report, type ReportLang } from "./i18n";
import { tid } from "./report-text";
import { hiringFor, type RunState } from "./state";
import { summary30s } from "./summary";

/** Most interview questions and to-verify items in the description; the full brief has the rest. */
const MAX_QUESTIONS = 8;
const MAX_TO_VERIFY = 5;
/** RFC 5545 §3.1: content lines are at most 75 octets, excluding the line break. */
const MAX_OCTETS = 75;

const encoder = new TextEncoder();

/** UTC date-time in the basic format, e.g. 20261012T080000Z. */
function icsTime(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/** RFC 5545 TEXT escaping: backslash, semicolon, comma and line breaks. */
export function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds one content line at 75 octets (CRLF + one space), never inside a UTF-8 character. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Non-empty brief items translated by id (index in the brief), at most `max`. */
function items(list: readonly string[], idOf: (i: number) => string, text: (id: string, english: string) => string, max: number): string[] {
  return list
    .map((english, i) => ({ english, id: idOf(i) }))
    .filter((e) => e.english.trim() !== "")
    .slice(0, max)
    .map((e) => text(e.id, e.english).trim());
}

/** The invite in the report language (English by default), or null while there is no brief. */
export function interviewInvite(
  state: RunState,
  opts: { start: Date; minutes: number; briefUrl: string; now: Date },
  report: Report = ENGLISH_REPORT,
): string | null {
  const english = summary30s(state);
  if (english === null || state.brief === null) return null;
  const x = exportText(report);
  const { invite } = x.d;
  const summary = localSummary(english, x);
  const subject = state.subject.trim() === "" ? x.d.unnamed : state.subject.trim();
  const role = hiringFor(state)?.trim() ?? "";
  const questions = items(state.brief.interview_questions, tid.interviewQuestion, x.text, MAX_QUESTIONS);
  const toVerify = items(state.brief.to_verify, tid.toVerify, x.text, MAX_TO_VERIFY);
  const until = deletionDate(state.created_at).slice(0, 10);
  const end = new Date(opts.start.getTime() + opts.minutes * 60_000);
  // RFC 5545 languageparam on the two text properties; none in English, as before.
  const param = x.lang === "en" ? "" : `;LANGUAGE=${x.lang}`;

  const description = [
    summary.documented,
    summary.missing,
    summary.ask,
    ...(questions.length > 0 ? ["", invite.questions, ...questions.map((q, i) => `${String(i + 1)}. ${q}`)] : []),
    ...(toVerify.length > 0 ? ["", invite.toVerify, ...toVerify.map((t) => `- ${t}`)] : []),
    "",
    `${invite.fullBrief}${opts.briefUrl}`,
    `${invite.guardrail}${x.d.deletedAfter(until)}`,
  ].join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//oldboys//interview invite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:interview-${state.id}@oldboys.asajj.cz`,
    `DTSTAMP:${icsTime(opts.now)}`,
    `DTSTART:${icsTime(opts.start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY${param}:${escapeText(invite.summary(subject, role))}`,
    `URL:${opts.briefUrl}`,
    `DESCRIPTION${param}:${escapeText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** interview-<first 8 characters of the run id>.ics ("-cs.ics" in Czech); never the candidate's name. */
export function inviteFileName(state: RunState, lang: ReportLang = "en"): string {
  return exportFileName(`interview-${state.id.slice(0, 8)}.ics`, lang);
}
