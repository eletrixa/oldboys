/**
 * Report language (idea #24): the brief area's static labels in English and Czech, and the Report lookup the brief renders with.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/i18n.ts
 * Deps:    src/domain/{challenge,claim,cv-check} (types), ./evidence (English date labels), ./challenge (English challenge words), ./cv-check (English CV labels), ./report-text, ./state (types)
 * Tested:  src/app/runs/[id]/__tests__/i18n.test.ts
 *
 * Key responsibilities:
 * - ReportDict: every label of the brief area (headings, confidence badges, kind pills, "Show evidence" panel, CV check
 *   labels, gap headings, 30-second summary card, "Hiring for" / "Confirmed profile", the language switch itself);
 *   REPORT_DICT has both languages, so a missing Czech key is a type error
 * - Czech: formal, gender-neutral (same style as candidate-copy-cs.ts); words rate the research, never the candidate;
 *   quotes are labelled "citace v originále" and never translated
 * - makeReport(lang, texts): the dictionary plus text(id, english), which returns the translated text or the English one
 *
 * Design constraints:
 * - Pure data and functions, no React (the context lives in report-lang.tsx)
 * - The rest of the app (start form, roles, audit, call panel, exports) stays English
 */
import type { ChallengeGround } from "@/domain/challenge";
import type { Claim, Coverage } from "@/domain/claim";
import type { CvOutcome } from "@/domain/cv-check";
import { type ChallengeSummary, challengeLine, challengeReason, challengeTag } from "./challenge";
import { CV_EXPLAINER, CV_OUTCOME } from "./cv-check";
import { keptUntilLabel, retrievedLabel } from "./evidence";
import type { SummaryLead } from "./report-text";
import type { ConfidenceBand } from "./state";

export type ReportLang = "en" | "cs";

export type ReportDict = {
  switchGroup: string;
  translating: string;
  quotesNote: string;
  summaryEyebrow: string;
  summaryTitle: string;
  readAloud: string;
  stopReading: string;
  speechLang: string;
  lead: Record<SummaryLead, string>;
  confirmedProfile: string;
  hiringFor: string;
  band: Record<ConfidenceBand, string>;
  kind: Record<Claim["kind"], string>;
  coverage: Record<Coverage, string>;
  conflicts: string;
  sourceMissing: string;
  sourceMissingRow: string;
  showEvidence: string;
  quoteFromSource: string;
  saidOnCall: string;
  inferenceNote: string;
  noSource: string;
  openSource: string;
  openAtQuote: string;
  confirmedBecause: (reason: string) => string;
  retrieved: (iso: string | null | undefined) => string;
  savedCopy: (expiresIso: string | null | undefined) => string;
  challengeTag: (ground: ChallengeGround) => string;
  challengeReason: (ground: ChallengeGround, why: string) => string;
  devilsAdvocate: (summary: ChallengeSummary | null | undefined) => string | null;
  cvOutcome: Record<CvOutcome, string>;
  cvExplainer: string;
  interviewQuestions: string;
  toVerify: string;
  checkPill: string;
  searched: (namesakeOnly: boolean) => string;
  notSearched: string;
  alsoFound: (n: number) => string;
  notUsed: string;
  removedProtected: (n: number) => string;
  fromConfirmed: string;
  roleCriteriaOff: string;
  noRoleCriteria: string;
  degraded: (reason: string) => string;
  showMore: (n: number) => string;
  label: (english: string) => string;
};

const EN: ReportDict = {
  switchGroup: "Report language",
  translating: "Translating…",
  quotesNote: "",
  summaryEyebrow: "Summary",
  summaryTitle: "In 30 seconds",
  readAloud: "Read aloud",
  stopReading: "Stop",
  speechLang: "en-US",
  lead: { Confirmed: "Confirmed", Missing: "Missing", Ask: "Ask", Check: "Check" },
  confirmedProfile: "Confirmed profile",
  hiringFor: "Hiring for",
  band: { strong: "Strong evidence", fair: "Some evidence", weak: "Thin evidence" },
  kind: { FACT: "Fact", INFERENCE: "Inference", STATEMENT: "Statement" },
  coverage: { evidenced: "evidenced", partial: "partial", none: "none" },
  conflicts: "Conflicts with another claim",
  sourceMissing: "source missing",
  sourceMissingRow: "Source missing",
  showEvidence: "Show evidence",
  quoteFromSource: "Quote from the source",
  saidOnCall: "Said by the candidate, not public evidence",
  inferenceNote: "Inference: no direct quote, drawn from these sources",
  noSource: "No source recorded",
  openSource: "Open the source",
  openAtQuote: "Open at the quote",
  confirmedBecause: (reason) => `Confirmed: ${reason}`,
  retrieved: retrievedLabel,
  savedCopy: (iso) => {
    const kept = keptUntilLabel(iso);
    return `Saved copy when retrieved${kept === null ? "" : ` (kept until ${kept})`}`;
  },
  challengeTag,
  challengeReason: (ground, why) => challengeReason({ ground, why }),
  devilsAdvocate: challengeLine,
  cvOutcome: { matches: CV_OUTCOME.matches.label, differs: CV_OUTCOME.differs.label, "not-found": CV_OUTCOME["not-found"].label },
  cvExplainer: CV_EXPLAINER,
  interviewQuestions: "Interview questions",
  toVerify: "To verify",
  checkPill: "Check",
  searched: (namesakeOnly) => (namesakeOnly ? "Searched, nothing confirmed" : "Searched, nothing found"),
  notSearched: "Not searched, and why",
  alsoFound: (n) => `Same name, not confirmed as them (${String(n)})`,
  notUsed: "Not used in your brief.",
  removedProtected: (n) => `${String(n)} ${n === 1 ? "item" : "items"} removed (protected categories)`,
  fromConfirmed: "From profiles you confirmed",
  roleCriteriaOff: "Role criteria (not checked, AI unavailable)",
  noRoleCriteria: "No role criteria yet",
  degraded: (reason) => `AI summary unavailable (${reason.replace(/\.$/, "")}). This brief lists only what we confirmed.`,
  showMore: (n) => `Show ${String(n)} more`,
  label: (english) => english,
};

function parse(iso: string | null | undefined): Date | null {
  if (typeof iso !== "string" || iso === "") return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "9. 10. 2026" (UTC). */
const dayCs = (d: Date): string => `${String(d.getUTCDate())}. ${String(d.getUTCMonth() + 1)}. ${String(d.getUTCFullYear())}`;

const pad = (n: number): string => String(n).padStart(2, "0");

const GROUND_CS: Record<ChallengeGround, string> = {
  "someone-else": "může jít o jinou osobu",
  "fork-or-copy": "může jít o fork, ne o vlastní práci",
  "tutorial-or-course": "může jít o cvičení z tutoriálu nebo kurzu",
  outdated: "doklad může být zastaralý",
};

/** Generic source labels (GAP_LABEL, STEP_LABEL, evidenceGroup); platform and register names stay as they are. */
const LABEL_CS: Record<string, string> = {
  "Web search": "Vyhledávání na webu",
  "Social profile search": "Hledání profilů na sociálních sítích",
  "Personal website": "Osobní web",
  "Talks and posts": "Přednášky a příspěvky",
  Website: "Web",
  "LinkedIn company": "LinkedIn (firma)",
  "ARES registry": "Registr ARES",
  "ARES public register": "Veřejný rejstřík (ARES)",
  CV: "Životopis",
};

const CS: ReportDict = {
  switchGroup: "Jazyk podkladu",
  translating: "Překládám…",
  quotesNote: "Citace ze zdrojů ponecháváme v originále, aby šly ověřit.",
  summaryEyebrow: "Shrnutí",
  summaryTitle: "Za 30 sekund",
  readAloud: "Přečíst nahlas",
  stopReading: "Zastavit",
  speechLang: "cs-CZ",
  lead: { Confirmed: "Potvrzeno", Missing: "Chybí", Ask: "Zeptejte se", Check: "Ověřte" },
  confirmedProfile: "Potvrzený profil",
  hiringFor: "Obsazovaná pozice",
  band: { strong: "Silné doložení", fair: "Částečné doložení", weak: "Slabé doložení" },
  kind: { FACT: "Fakt", INFERENCE: "Odvození", STATEMENT: "Výrok" },
  coverage: { evidenced: "doloženo", partial: "částečně", none: "bez dokladů" },
  conflicts: "V rozporu s jiným zjištěním",
  sourceMissing: "zdroj chybí",
  sourceMissingRow: "Zdroj chybí",
  showEvidence: "Zobrazit doklady",
  quoteFromSource: "Citace v originále",
  saidOnCall: "Řečeno v ověřovacím hovoru, nejde o veřejný doklad (citace v originále)",
  inferenceNote: "Odvození: bez přímé citace, vychází z těchto zdrojů",
  noSource: "Zdroj nebyl zaznamenán",
  openSource: "Otevřít zdroj",
  openAtQuote: "Otevřít u citace",
  confirmedBecause: (reason) => `Potvrzeno: ${reason}`,
  retrieved: (iso) => {
    const d = parse(iso);
    return d === null ? "Čas načtení nebyl zaznamenán" : `Načteno ${dayCs(d)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  },
  savedCopy: (iso) => {
    const d = parse(iso);
    return `Uložená kopie z doby načtení${d === null ? "" : ` (uchováváme do ${dayCs(d)})`}`;
  },
  challengeTag: (ground) => `Zpochybněno: ${GROUND_CS[ground]} — zeptejte se u pohovoru`,
  challengeReason: (ground, why) => {
    const w = why.trim().replace(/\.$/, "");
    return w === "" ? `Zpochybněno: ${GROUND_CS[ground]}` : `Zpochybněno: ${GROUND_CS[ground]} (${w})`;
  },
  devilsAdvocate: (s) =>
    s === null || s === undefined || s.checked === 0
      ? null
      : `Ďáblův advokát: prověřená zjištění ${String(s.checked)}, obstála ${String(s.held)}, přesunuta k pohovoru ${String(s.moved)}`,
  cvOutcome: { matches: "Shoduje se s veřejnými zdroji", differs: "Liší se — zeptejte se, nesuďte", "not-found": "Veřejně nedohledáno" },
  cvExplainer: "Rozdíl je otázka k pohovoru, ne verdikt. V životopisech se data často zaokrouhlují nebo uvádějí starší názvy pozic.",
  interviewQuestions: "Otázky k pohovoru",
  toVerify: "K ověření",
  checkPill: "Ověřit",
  searched: (namesakeOnly) => (namesakeOnly ? "Prohledáno, nic nepotvrzeno" : "Prohledáno, nic nenalezeno"),
  notSearched: "Neprohledáno, a proč",
  alsoFound: (n) => `Stejné jméno, nepotvrzeno jako tatáž osoba (${String(n)})`,
  notUsed: "Do podkladu jsme to nezahrnuli.",
  removedProtected: (n) => `Odstraněné položky (chráněné kategorie): ${String(n)}`,
  fromConfirmed: "Z profilů, které jste potvrdili",
  roleCriteriaOff: "Kritéria pozice (neověřena, AI nebyla k dispozici)",
  noRoleCriteria: "Zatím žádná kritéria pozice",
  degraded: (reason) => `Shrnutí od AI není k dispozici (${reason.replace(/\.$/, "")}). Podklad uvádí jen to, co jsme potvrdili.`,
  showMore: (n) => `Zobrazit další (${String(n)})`,
  label: (english) => LABEL_CS[english] ?? english,
};

export const REPORT_DICT: Readonly<Record<ReportLang, ReportDict>> = { en: EN, cs: CS };

/** What the brief renders with: the language, its labels, and the translated text per id (English when missing). */
export type Report = { lang: ReportLang; t: ReportDict; text: (id: string, english: string) => string };

export function makeReport(lang: ReportLang, texts: Readonly<Record<string, string>> | null): Report {
  const t = REPORT_DICT[lang];
  if (lang === "en" || texts === null) return { lang, t, text: (_id, english) => english };
  return { lang, t, text: (id, english) => texts[id] ?? english };
}

export const ENGLISH_REPORT: Report = makeReport("en", null);
