/**
 * Export language (idea #24, follow-up): the fixed lines of the interview kit, calendar invite and kit review in English
 * and Czech, on top of the brief's Report (labels + translated text per id). The ATS note and reference questions keep
 * their own wording next to their builders (ats-note.ts, reference-check.ts) and take the same Report.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/export-text.ts
 * Deps:    src/domain/{call,claim} (types), ./call-panel (ANSWER_BADGE), ./challenge, ./cv-check, ./evidence (retrievedLabel), ./i18n (REPORT_DICT, makeReport), ./report-text (tid), ./state
 * Tested:  src/app/runs/[id]/__tests__/export-text.test.ts, the export tests (interview-kit, interview-invite, kit-review)
 *
 * Key responsibilities:
 * - The exports take a Report (makeReport(lang, texts)): the report language chosen with the brief's EN | CZ switch and
 *   the cached brief translation (ids from reportTexts); makeReport("cs", null) = Czech fixed lines with English texts
 * - EXPORT_DICT: every fixed line per export in both languages (typed, so a missing Czech key is a compile error);
 *   the English values are the exports' existing words, character for character
 * - exportText: dictionary + the Report's labels and text(id, english) (translation or English per text)
 * - The 30-second summary sentences come from summaryIn (summary-cs.ts); an ExportText is a Report for it
 * - toVerifyTexts: the "To verify" items in the export language (brief items by index, appended challenged claims by
 *   claim id, devil's advocate reasons translated), the same mapping the brief uses
 * - exportFileName: "-cs" before the extension for Czech downloads
 *
 * Design constraints:
 * - Pure, no React; Czech is formal and gender-neutral (style of candidate-copy-cs.ts), dates "9. 10. 2026"
 * - Quotes, URLs, names, company names and the headline are never translated; the guardrail lines keep their meaning
 */
import type { CallAnswerStatus } from "@/domain/call";
import type { Brief, Claim, Coverage } from "@/domain/claim";
import { formatDuration } from "@/domain/run-cost";
import { ANSWER_BADGE } from "./call-panel";
import { challengeReason, challengesById, toVerifyItems } from "./challenge";
import { REPORT_DICT, type Report, type ReportDict, type ReportLang } from "./i18n";
import { tid } from "./report-text";
import type { RunState } from "./state";

type Research = { usd: number; sourceCalls: number; llmCalls: number; durationMs: number };

export type ExportDict = {
  unnamed: string;
  /** "2026-10-15" as the export writes a day. */
  day: (isoDay: string) => string;
  /** Deletion sentence after the guardrail, "" without a date. */
  deletedAfter: (isoDay: string) => string;
  kit: {
    title: string;
    hiringFor: (role: string) => string;
    confirmedProfile: (headline: string) => string;
    generated: (day: string) => string;
    research: (r: Research) => string;
    /** Header line when the kit shows a quote; "" in English. */
    quotesNote: string;
    covered: string;
    coverage: (c: Coverage) => string;
    found: string;
    confidence: (pct: number, band: "strong" | "fair" | "weak", reason: string) => string;
    aiUnavailable: (reason: string) => string;
    roleCriteria: string;
    kind: Record<Claim["kind"], string>;
    quote: string;
    questions: string;
    notes: string;
    codeProfile: string;
    profileSignals: string;
    /** Heading of the role-fit scorecard section (plans/013); the lines stay English. */
    scorecard: string;
    phone: string;
    answer: Record<CallAnswerStatus, string>;
    at: (time: string) => string;
    mock: string;
    footer: string;
    removed: (n: number) => string;
  };
  invite: { summary: (subject: string, role: string) => string; questions: string; toVerify: string; fullBrief: string; guardrail: string };
  review: { open: string; allCovered: string };
};

const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

/** "2026-10-15" → "15. 10. 2026" (no leading zeros); anything else unchanged. */
export function dayCs(isoDay: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay);
  return m === null ? isoDay : `${String(Number(m[3]))}. ${String(Number(m[2]))}. ${m[1] ?? ""}`;
}

const EN: ExportDict = {
  unnamed: "unnamed person",
  day: (d) => d,
  deletedAfter: (d) => (d === "" ? "" : ` Run data is deleted after ${d}.`),
  kit: {
    title: "Interview kit",
    hiringFor: (role) => `Hiring for: ${role}`,
    confirmedProfile: (h) => `Confirmed profile: ${h}`,
    generated: (d) => `Generated: ${d}`,
    research: (r) =>
      `Research: $${r.usd.toFixed(2)} · ${plural(r.sourceCalls, "source call")} · ${plural(r.llmCalls, "AI call")} · ${formatDuration(r.durationMs)}`,
    quotesNote: "",
    covered: "What the research covered",
    coverage: (c) => `Coverage: ${c}`,
    found: "What the research found",
    confidence: (pct, band, reason) => `Research confidence: ${String(pct)}% (${band}), ${reason}`,
    aiUnavailable: (reason) => `AI summary unavailable: ${reason}`,
    roleCriteria: "Role criteria (not checked)",
    kind: { FACT: "FACT", INFERENCE: "INFERENCE", STATEMENT: "STATEMENT" },
    quote: "Quote",
    questions: "Questions for the interview",
    notes: "Notes:",
    codeProfile: "Code contributions (public GitHub)",
    profileSignals: "Profile signals (public accounts)",
    scorecard: "Role fit scorecard (pluses and minuses, with evidence)",
    phone: "Phone verification (said by the candidate, not public evidence)",
    answer: {
      answered: ANSWER_BADGE.answered.label,
      unclear: ANSWER_BADGE.unclear.label,
      declined: ANSWER_BADGE.declined.label,
      no_answer: ANSWER_BADGE.no_answer.label,
      not_asked: ANSWER_BADGE.not_asked.label,
    },
    at: (time) => `at ${time}`,
    mock: "MOCK call: the answers are simulated.",
    footer: "This kit rates the research, never the candidate. Public sources only; run data is deleted after 7 days.",
    removed: (n) => `${plural(n, "item")} removed (protected categories)`,
  },
  invite: {
    summary: (subject, role) => (role === "" ? `Interview: ${subject}` : `Interview: ${subject} for ${role}`),
    questions: "Questions for the interview:",
    toVerify: "To verify:",
    fullBrief: "Full brief with sources: ",
    guardrail: "This invite rates the research, not the candidate.",
  },
  review: { open: "Still open after the interview:", allCovered: "Every point from the kit was covered in the interview." },
};

const CS_REPORT = REPORT_DICT.cs;

const BAND_CS: Record<"strong" | "fair" | "weak", string> = { strong: "silné doložení", fair: "částečné doložení", weak: "slabé doložení" };

const CS: ExportDict = {
  unnamed: "nejmenovaná osoba",
  day: dayCs,
  deletedAfter: (d) => (d === "" ? "" : ` Data z průzkumu smažeme po ${dayCs(d)}.`),
  kit: {
    title: "Podklady k pohovoru",
    hiringFor: (role) => `${CS_REPORT.hiringFor}: ${role}`,
    confirmedProfile: (h) => `${CS_REPORT.confirmedProfile}: ${h}`,
    generated: (d) => `Vytvořeno: ${d}`,
    research: (r) =>
      `Náklady průzkumu: ${r.usd.toFixed(2).replace(".", ",")} USD · volání zdrojů: ${String(r.sourceCalls)} · volání AI: ${String(r.llmCalls)} · ${formatDuration(r.durationMs)}`,
    quotesNote: "Texty v uvozovkách jsou citace ze zdrojů, nepřekládáme je, aby šly ověřit (citace v originále).",
    covered: "Co průzkum pokryl",
    coverage: (c) => `Pokrytí: ${CS_REPORT.coverage[c]}`,
    found: "Co průzkum zjistil",
    confidence: (pct, band, reason) => `Spolehlivost průzkumu: ${String(pct)} % (${BAND_CS[band]}), ${reason}`,
    aiUnavailable: (reason) => `Shrnutí od AI není k dispozici: ${reason}`,
    roleCriteria: "Kritéria pozice (neověřena)",
    kind: { FACT: "FAKT", INFERENCE: "ODVOZENÍ", STATEMENT: "VÝROK" },
    quote: "Citace",
    questions: CS_REPORT.interviewQuestions,
    notes: "Poznámky:",
    codeProfile: "Příspěvky do kódu (veřejný GitHub)",
    profileSignals: "Signály z profilů (veřejné účty, věty anglicky)",
    scorecard: "Shoda s rolí: plusy a minusy s důkazy (věty anglicky)",
    phone: "Ověřovací hovor (řečeno v hovoru, nejde o veřejný doklad)",
    answer: { answered: "Zodpovězeno", unclear: "Nejasné", declined: "Odmítnuto", no_answer: "Bez odpovědi", not_asked: "Nepoloženo" },
    at: (time) => `v čase ${time}`,
    mock: "Simulovaný hovor (MOCK): odpovědi nejsou skutečné.",
    footer: "Tyto podklady hodnotí výzkum, ne kandidáta. Jen veřejné zdroje; data z průzkumu smažeme po 7 dnech.",
    removed: CS_REPORT.removedProtected,
  },
  invite: {
    summary: (subject, role) => (role === "" ? `Pohovor: ${subject}` : `Pohovor: ${subject}, pozice ${role}`),
    questions: `${CS_REPORT.interviewQuestions}:`,
    toVerify: `${CS_REPORT.toVerify}:`,
    fullBrief: "Celý podklad se zdroji: ",
    guardrail: "Tato pozvánka hodnotí výzkum, ne kandidáta.",
  },
  review: { open: "Po pohovoru zůstává otevřené:", allCovered: "Všechny body z podkladů k pohovoru byly na pohovoru probrány." },
};

export const EXPORT_DICT: Readonly<Record<ReportLang, ExportDict>> = { en: EN, cs: CS };

/** What an export renders with: its fixed lines, the brief's labels and the translated text per id (English when missing). */
export type ExportText = { lang: ReportLang; d: ExportDict; t: ReportDict; text: (id: string, english: string) => string };

export function exportText(report: Report): ExportText {
  return { lang: report.lang, d: EXPORT_DICT[report.lang], t: report.t, text: report.text };
}

/** "To verify" items with their devil's advocate reason, in the export language (same ids as the brief). */
export function toVerifyTexts(state: RunState, brief: Brief, x: ExportText): { text: string; reason: string | null }[] {
  const challengeOf = challengesById(state);
  return toVerifyItems(brief, state.claims, challengeOf).map((item, i) => {
    const claim = state.claims.find((c) => c.text === item.text && challengeOf.has(c.id));
    const ch = claim === undefined ? undefined : challengeOf.get(claim.id);
    const text = i < brief.to_verify.length ? x.text(tid.toVerify(i), item.text) : x.text(tid.claim(claim?.id ?? ""), item.text);
    if (ch === undefined || claim === undefined) return { text, reason: item.reason };
    return { text, reason: x.lang === "en" ? challengeReason(ch) : x.t.challengeReason(ch.ground, x.text(tid.challenge(claim.id), ch.why)) };
  });
}

/** "interview-kit-0123abcd.md" → "interview-kit-0123abcd-cs.md" for Czech. */
export function exportFileName(name: string, lang: ReportLang): string {
  if (lang === "en") return name;
  const dot = name.lastIndexOf(".");
  return dot < 0 ? `${name}-${lang}` : `${name.slice(0, dot)}-${lang}${name.slice(dot)}`;
}
