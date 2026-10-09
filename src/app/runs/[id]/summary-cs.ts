/**
 * The 30-second summary in the report language: English as summary30s writes it, Czech built from the same counts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/summary-cs.ts
 * Deps:    ./summary (counts, gaps, ask item), ./cv-check (cvCounts), ./i18n (Report), ./report-text (splitLead, tid), ./state
 * Tested:  src/app/runs/[id]/__tests__/summary-cs.test.ts
 *
 * Key responsibilities:
 * - summaryLines(state, report): the three lines as { lead, body } (lead in the report language, null without one)
 *   for the card (lead coloured) and the exports; summaryIn joins them as "Lead: body"
 * - Czech documented / missing lines from structured data only (platform names, counts, criterion ids):
 *   "Potvrzeno: profily LinkedIn a GitHub a další 4 zdroje. Doložená kritéria pozice: 0 ze 4."
 *   "Chybí doklad k: „<criterion in Czech>“; „…“." (criterion text by its q:<id> translation, English per missing one)
 * - Czech ask line: the first interview question by its iq: id, else the first to-verify item by its tv: id
 * - czPlural / zOrZe: Czech number agreement (1 zdroj, 2–4 zdroje, 5+ zdrojů) and "z 5" / "ze 4"
 *
 * Design constraints:
 * - Never translate a finished English sentence: a model once turned "0 of 4 role criteria have evidence" into
 *   "0 ze 4 kritérií pozice není doloženo" (the opposite); counts and negations are only ever written here
 * - English output equals summary30s byte for byte; pure and deterministic, words rate the research, not the candidate
 */
import { cvCounts } from "./cv-check";
import type { Report } from "./i18n";
import { splitLead, tid } from "./report-text";
import type { RunState } from "./state";
import {
  ASK_MAX,
  type SummaryGap,
  type Summary30s,
  aiOff,
  askItem,
  confirmedSources,
  criteriaCounts,
  gapSourceLabel,
  sentence,
  shorten,
  summary30s,
  summaryGaps,
} from "./summary";

export type SummaryLine = { lead: string | null; body: string };
export type SummaryLines = Record<keyof Summary30s, SummaryLine>;

/** Czech noun form for n: 1 → one, 2–4 → few, else (0, 5+) → many. */
export function czPlural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  return n >= 2 && n <= 4 ? few : many;
}

/** Czech "z" / "ze" before a number as it is read: "ze 4" (čtyř), "ze 7" (sedmi), "z 5" (pěti), "z 1" (jednoho). */
export function zOrZe(n: number): string {
  const ze = [2, 3, 4, 6, 7, 12, 17].includes(n) || (n >= 20 && n < 50) || (n >= 60 && n < 80) || (n >= 100 && n < 200);
  return ze ? "ze" : "z";
}

/** "A", "A a B", "A, B a C". */
function joinAndCs(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} a ${items[items.length - 1] ?? ""}`;
}

/** "profily LinkedIn a GitHub a další 4 zdroje", "2 webové zdroje", or null when nothing is confirmed. */
function confirmedPhraseCs(platforms: readonly string[], other: number): string | null {
  const parts = [
    ...(platforms.length > 0 ? [`${platforms.length === 1 ? "profil" : "profily"} ${joinAndCs(platforms)}`] : []),
    ...(other > 0
      ? [
          platforms.length > 0
            ? `další ${String(other)} ${czPlural(other, "zdroj", "zdroje", "zdrojů")}`
            : `${String(other)} ${czPlural(other, "webový zdroj", "webové zdroje", "webových zdrojů")}`,
        ]
      : []),
  ];
  return parts.length === 0 ? null : parts.join(" a ");
}

/** "Životopis: shoda s veřejnými zdroji u 3 údajů, k doptání 1, veřejně nedohledáno 1." or null without a CV check. */
function cvLineCs(state: RunState): string | null {
  const c = cvCounts(state);
  if (c.matches + c.differs + c["not-found"] === 0) return null;
  const notFound = c["not-found"] > 0 ? `, veřejně nedohledáno ${String(c["not-found"])}` : "";
  return `Životopis: shoda s veřejnými zdroji u ${String(c.matches)} ${c.matches === 1 ? "údaje" : "údajů"}, k doptání ${String(c.differs)}${notFound}.`;
}

function documentedCs(state: RunState, brief: NonNullable<RunState["brief"]>, off: boolean, report: Report): SummaryLine {
  const { platforms, other } = confirmedSources(state, brief);
  const phrase = confirmedPhraseCs(platforms, other);
  const head: SummaryLine = phrase === null ? { lead: null, body: "Zatím žádný potvrzený profil" } : { lead: report.t.lead.Confirmed, body: phrase };
  const { noun, total, evidenced, partial } = criteriaCounts(brief);
  const counted = off
    ? " Kritéria pozice jsme neověřovali, AI byla vypnutá."
    : total === 0
      ? ""
      : ` ${noun === "role criteria" ? "Doložená kritéria pozice" : "Doložené výzkumné otázky"}: ${String(evidenced)} ${zOrZe(total)} ${String(total)}${partial > 0 ? `, částečně ${String(partial)}` : ""}.`;
  const cv = cvLineCs(state);
  return { lead: head.lead, body: `${head.body}.${counted}${cv === null ? "" : ` ${cv}`}` };
}

function sourceGapCs(g: Exclude<SummaryGap, { kind: "criterion" }>, report: Report): string {
  const label = report.t.label(gapSourceLabel(g.source));
  return g.kind === "empty" ? `${label} (prohledáno, nic nepotvrzeno)` : `${label} (neprohledáno)`;
}

function missingCs(gaps: readonly SummaryGap[], report: Report): SummaryLine {
  const criteria = gaps.flatMap((g) => (g.kind === "criterion" ? [`„${shorten(report.text(tid.question(g.questionId), g.text), 60)}“`] : []));
  const sources = gaps.flatMap((g) => (g.kind === "criterion" ? [] : [sourceGapCs(g, report)]));
  if (criteria.length > 0) {
    const rest = sources.length > 0 ? ` Dále: ${sources.join("; ")}.` : "";
    return { lead: report.t.summaryMissingEvidence, body: `${criteria.join("; ")}.${rest}` };
  }
  return { lead: report.t.lead.Missing, body: sources.length > 0 ? `${sources.join("; ")}.` : "žádné mezery nezaznamenány." };
}

function askCs(brief: NonNullable<RunState["brief"]>, report: Report): SummaryLine {
  const item = askItem(brief);
  if (item === null) return { lead: report.t.lead.Ask, body: "zatím žádná otázka k pohovoru." };
  if (item.kind === "ask") return { lead: report.t.lead.Ask, body: sentence(report.text(tid.interviewQuestion(item.index), item.text), ASK_MAX) };
  return { lead: report.t.lead.Check, body: sentence(report.text(tid.toVerify(item.index), item.text), ASK_MAX) };
}

function englishLines(s: Summary30s, report: Report): SummaryLines {
  const line = (part: keyof Summary30s): SummaryLine => {
    const { lead, body } = splitLead(s[part]);
    return { lead: lead === null ? null : report.t.lead[lead], body };
  };
  return { documented: line("documented"), missing: line("missing"), ask: line("ask") };
}

/** The three lines in the report language, or null while there is no brief. */
export function summaryLines(state: RunState, report: Report): SummaryLines | null {
  const { brief } = state;
  if (brief === null) return null;
  if (report.lang === "en") {
    const s = summary30s(state);
    return s === null ? null : englishLines(s, report);
  }
  const off = aiOff(brief);
  return {
    documented: documentedCs(state, brief, off, report),
    missing: missingCs(summaryGaps(state, brief, off), report),
    ask: askCs(brief, report),
  };
}

/** "Lead: body", or the body alone. */
export function lineText(l: SummaryLine): string {
  return l.lead === null ? l.body : `${l.lead}: ${l.body}`;
}

/** The three sentences in the report language (English = summary30s), or null while there is no brief. */
export function summaryIn(state: RunState, report: Report): Summary30s | null {
  const l = summaryLines(state, report);
  return l === null ? null : { documented: lineText(l.documented), missing: lineText(l.missing), ask: lineText(l.ask) };
}
