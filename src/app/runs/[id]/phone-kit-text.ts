/**
 * Labels of the phone panel and the interview-kit sidebar of a finished brief in English and Czech.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/phone-kit-text.ts
 * Deps:    ./summary-cs (czPlural, zOrZe)
 * Tested:  src/app/runs/[id]/__tests__/phone-kit-text.test.ts, __tests__/i18n.test.ts (same keys in both languages)
 *
 * Key responsibilities:
 * - CallUi: panel title and intro, call status lines, STATEMENT tag, SAID_NOTE, meta line, setup form labels, hints,
 *   validation and error messages, "N of M calls" lines; reached as `report.t.call` (REPORT_DICT in i18n.ts)
 * - KitUi: sidebar "Interview kit" card, exports, calendar invite form, filled-kit review, "About this research",
 *   delete box line, footer note; reached as `report.t.kit` ("About this research" lives in `report.t.ui`)
 * - English values are the page's words byte for byte (call-panel.ts keeps its English helpers for the routes and tests)
 *
 * Design constraints:
 * - Pure data; a phone answer is a STATEMENT ("VÝROK"), never a fact; no verdict words, no score
 * - Czech: formal (vykání), "kandidát či kandidátka", phone screen = "telefonický screening" like the Phone tab
 * - Not translated here: the questions and first message the agent says (the call is in English), quotes, numbers,
 *   messages that come from the API or the provider
 */
import { czPlural, zOrZe } from "./summary-cs";

type ApproveStatus = 400 | 409 | 502;

export type CallUi = {
  title: string;
  intro: string;
  mockDetail: string;
  loading: string;
  loadError: string;
  placing: string;
  loginExpired: string;
  logInAgain: string;
  unreachable: string;
  timedOut: string;
  prepareFailed: string;
  approveError: Record<ApproveStatus, string>;
  httpFailed: (status: number) => string;
  phase: {
    notPlaced: string;
    skipped: string;
    calling: (masked: string | null) => string;
    noAnswer: string;
    refused: string;
    failed: (reason: string | null) => string;
    finished: string;
    readFailed: (error: string) => string;
    reading: string;
  };
  identityNotConfirmed: string;
  statementTag: string;
  saidNote: string;
  meta: { duration: (at: string) => string; cost: (usd: number) => string; identity: (confirmed: boolean | null) => string };
  callAgain: (left: number, max: number) => string;
  usage: (used: number, max: number) => string;
  earlier: (n: number) => string;
  earlierAt: (iso: string) => string;
  noNumber: string;
  questionsHeading: string;
  englishNote: string;
  aiDrafted: string;
  rulesFallback: string;
  drafting: string;
  /** Prefixes before an AI draft's follow-up question and listen-for note (both stay English). */
  followUp: string;
  listenFor: string;
  noQuestions: string;
  question: (n: number) => string;
  removeQuestion: (n: number) => string;
  addQuestion: string;
  resetToProposal: string;
  firstMessage: string;
  why: (why: string) => string;
  numberLabel: string;
  nameLabel: string;
  agreedLabel: string;
  agreedPlaceholder: string;
  consent: string;
  callNow: string;
  problem: {
    allUsed: (max: number) => string;
    addOne: string;
    atMost: (n: number) => string;
    length: (min: number, max: number) => string;
    number: string;
    consent: string;
    note: string;
    operator: string;
  };
};

export type KitUi = {
  heading: string;
  intro: string;
  copyKit: string;
  copied: string;
  copyFailed: string;
  calendar: string;
  addToCalendar: string;
  ics: string;
  moreExports: string;
  downloadMd: string;
  noticeLanguage: string;
  noticeIn: { en: string; cs: string };
  copyNotice: string;
  downloadNotice: string;
  copyAts: string;
  copyRefs: string;
  date: string;
  time: string;
  duration: string;
  downloadIcs: string;
  icsHint: string;
  reviewTitle: string;
  reviewLabel: string;
  reviewPlaceholder: string;
  reviewPrivate: string;
  reviewCounts: (answered: number, questions: number, verified: number, checks: number) => string;
  reviewAllCovered: string;
  reviewOpen: string;
  copyOpen: string;
  notAKit: string;
  asideLabel: string;
  deleteWhen: string;
  neverScores: string;
  allBriefs: string;
};

const plural = (n: number, one: string, many: string): string => `${String(n)} ${n === 1 ? one : many}`;
const usdEn = (usd: number): string => `$${usd.toFixed(2)}`;
/** "2026-10-09T04:12:00Z" → "2026-10-09 04:12" (as the page always showed it). */
const stampEn = (iso: string): string => iso.slice(0, 16).replace("T", " ");

export const CALL_EN: CallUi = {
  title: "Verify with the candidate by phone",
  intro: "The AI agent calls the candidate, asks these questions and saves the answers. A person reviews them.",
  mockDetail: "No real call. Answers are simulated.",
  loading: "Loading…",
  loadError: "We could not load the phone verification. Reload the page to try again.",
  placing: "Placing the call…",
  loginExpired: "Your login has expired.",
  logInAgain: "Log in again.",
  unreachable: "We could not reach the service. Please try again.",
  timedOut: "No result after 35 minutes. Reload the page later.",
  prepareFailed: "The call could not be prepared.",
  approveError: {
    400: "The phone number or consent was not accepted.",
    409: "This run already used all its calls.",
    502: "The phone provider could not place the call.",
  },
  httpFailed: (status) => `The call failed (HTTP ${String(status)}).`,
  phase: {
    notPlaced: "Not placed.",
    skipped: "Skipped.",
    calling: (masked) => `Calling ${masked ?? "the candidate"}…`,
    noAnswer: "No answer.",
    refused: "The candidate declined the call.",
    failed: (reason) => `Call failed: ${reason ?? "unknown reason"}`,
    finished: "Call finished.",
    readFailed: (error) => `Call finished, but the answers could not be read: ${error}`,
    reading: "Call finished, reading the answers…",
  },
  identityNotConfirmed: "The person did not confirm who they are. Nothing was saved.",
  statementTag: "STATEMENT",
  saidNote: "Said by the candidate on the phone. This is not public evidence and does not change the research coverage.",
  meta: {
    duration: (at) => `Duration ${at}`,
    cost: (usd) => `Cost ${usdEn(usd)}`,
    identity: (confirmed) => `Identity confirmed: ${confirmed === null ? "unknown" : confirmed ? "yes" : "no"}`,
  },
  callAgain: (left, max) => `Call again · ${String(left)} of ${String(max)} calls left`,
  usage: (used, max) => `${String(used)} of ${String(max)} ${max === 1 ? "call" : "calls"} used for this run`,
  earlier: (n) => `Earlier calls (${String(n)})`,
  earlierAt: stampEn,
  noNumber: "no number",
  questionsHeading: "Questions the agent will ask",
  englishNote: "",
  aiDrafted: "AI-drafted, edit before the call",
  rulesFallback: "The AI draft was not available, so these are the rule-based questions.",
  drafting: "Drafting questions from the research…",
  followUp: "Follow-up if the answer is vague: ",
  listenFor: "Listen for (not read aloud): ",
  noQuestions: "No questions. Add one below.",
  question: (n) => `Question ${String(n)}`,
  removeQuestion: (n) => `Remove question ${String(n)}`,
  addQuestion: "Add question",
  resetToProposal: "Reset to proposal",
  firstMessage: "What the agent says first",
  why: (why) => why,
  numberLabel: "Candidate's phone number",
  nameLabel: "Your name",
  agreedLabel: "How the candidate agreed",
  agreedPlaceholder: "agreed by email on 8 Oct",
  consent: "The candidate agreed to this call and to the recording.",
  callNow: "Call candidate now",
  problem: {
    allUsed: (max) => `This run already used all ${String(max)} calls.`,
    addOne: "Add at least one question.",
    atMost: (n) => `At most ${String(n)} questions.`,
    length: (min, max) => `Each question needs ${String(min)} to ${String(max)} characters.`,
    number: "Enter the phone number in international format, e.g. +420 777 123 456.",
    consent: "Confirm that the candidate agreed to the call and the recording.",
    note: "Note how the candidate agreed.",
    operator: "Enter your name.",
  },
};

export const KIT_EN: KitUi = {
  heading: "Interview kit",
  intro: "The plan, the evidence and the gaps as one document for the interview.",
  copyKit: "Copy interview kit",
  copied: "Copied",
  copyFailed: "Copy failed",
  calendar: "Calendar",
  addToCalendar: "Add interview to calendar",
  ics: " (.ics)",
  moreExports: "More exports",
  downloadMd: "Download .md",
  noticeLanguage: "Candidate notice language",
  noticeIn: { en: "Candidate notice in English", cs: "Candidate notice in Czech" },
  copyNotice: "Copy candidate notice",
  downloadNotice: "Download candidate notice (.md)",
  copyAts: "Copy for ATS",
  copyRefs: "Copy reference questions",
  date: "Date",
  time: "Time (your local time)",
  duration: "Duration",
  downloadIcs: "Download .ics",
  icsHint:
    "Import it into Google Calendar or Outlook and add the interviewers there. The invite carries the summary, the interview questions and a link to this brief.",
  reviewTitle: "After the interview: paste the filled kit",
  reviewLabel: "Filled interview kit (Markdown)",
  reviewPlaceholder: "Paste the kit here after the interview. Tick boxes with [x] or write notes; unticked points without notes stay open.",
  reviewPrivate: "Your notes stay in this browser; nothing is saved.",
  reviewCounts: (answered, questions, verified, checks) =>
    `Answered ${String(answered)} of ${plural(questions, "interview question", "interview questions")} · verified ${String(verified)} of ${plural(checks, "check", "checks")}`,
  reviewAllCovered: "Every point from the kit was covered in the interview.",
  reviewOpen: "Still open",
  copyOpen: "Copy open points",
  notAKit: "This does not look like an interview kit from this page.",
  asideLabel: "Interview kit and research details",
  deleteWhen: "Do this when the candidate is rejected.",
  neverScores: "Radar prepares evidence and never scores people. A person makes every decision.",
  allBriefs: "My briefs",
};

/** "0,12 USD" (Czech decimal comma, currency after the number, like `ui.costValue`). */
const usdCs = (usd: number): string => `${usd.toFixed(2).replace(".", ",")} USD`;
/** "2026-10-09T04:12:00Z" → "9. 10. 2026 04:12" (the UTC wall time the string carries). */
function stampCs(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(iso);
  if (m === null) return stampEn(iso);
  const [, year = "", month = "", day = "", time = ""] = m;
  return `${String(Number(day))}. ${String(Number(month))}. ${year} ${time}`;
}
/** Genitive after "z N": "z 1 hovoru", "ze 2 hovorů", "z 5 hovorů". */
const ofCalls = (max: number): string => `${zOrZe(max)} ${String(max)} ${czPlural(max, "hovoru", "hovorů", "hovorů")}`;

/** The proposal's `why` chips ("No public evidence: X", "Partial evidence: X", "To verify"); anything else as it is. */
function whyCs(why: string): string {
  if (why === "To verify") return "K ověření";
  if (why.startsWith("No public evidence: ")) return `Bez veřejného dokladu: ${why.slice("No public evidence: ".length)}`;
  if (why.startsWith("Partial evidence: ")) return `Částečný doklad: ${why.slice("Partial evidence: ".length)}`;
  return why;
}

export const CALL_CS: CallUi = {
  title: "Telefonický screening s kandidátem či kandidátkou",
  intro: "AI agent zavolá kandidátovi či kandidátce, položí tyto otázky a uloží odpovědi. Odpovědi zkontroluje člověk.",
  mockDetail: "Žádný skutečný hovor. Odpovědi jsou simulované.",
  loading: "Načítám…",
  loadError: "Telefonický screening se nepodařilo načíst. Zkuste stránku načíst znovu.",
  placing: "Spojuji hovor…",
  loginExpired: "Vaše přihlášení vypršelo.",
  logInAgain: "Přihlaste se znovu.",
  unreachable: "Službu se nepodařilo zastihnout. Zkuste to prosím znovu.",
  timedOut: "Ani po 35 minutách nemáme výsledek. Načtěte stránku později.",
  prepareFailed: "Hovor se nepodařilo připravit.",
  approveError: {
    400: "Telefonní číslo nebo souhlas nebyly přijaty.",
    409: "Tento průzkum už využil všechny hovory.",
    502: "Poskytovatel telefonie nemohl hovor uskutečnit.",
  },
  httpFailed: (status) => `Hovor se nezdařil (HTTP ${String(status)}).`,
  phase: {
    notPlaced: "Hovor nebyl uskutečněn.",
    skipped: "Přeskočeno.",
    calling: (masked) => (masked === null ? "Volám kandidátovi či kandidátce…" : `Volám na číslo ${masked}…`),
    noAnswer: "Hovor nikdo nepřijal.",
    refused: "Hovor byl odmítnut.",
    failed: (reason) => `Hovor se nezdařil: ${reason ?? "neznámý důvod"}`,
    finished: "Hovor skončil.",
    readFailed: (error) => `Hovor skončil, ale odpovědi se nepodařilo načíst: ${error}`,
    reading: "Hovor skončil, načítám odpovědi…",
  },
  identityNotConfirmed: "Volaná osoba nepotvrdila svou totožnost. Nic se neuložilo.",
  statementTag: "VÝROK",
  saidNote: "Zaznělo v telefonu od kandidáta či kandidátky. Nejde o veřejný doklad a nemění to pokrytí výzkumu.",
  meta: {
    duration: (at) => `Délka ${at}`,
    cost: (usd) => `Cena ${usdCs(usd)}`,
    identity: (confirmed) => `Totožnost potvrzena: ${confirmed === null ? "neznámo" : confirmed ? "ano" : "ne"}`,
  },
  callAgain: (left, max) => `Zavolat znovu · ${czPlural(left, "zbývá", "zbývají", "zbývá")} ${String(left)} ${ofCalls(max)}`,
  usage: (used, max) => `Využito ${String(used)} ${ofCalls(max)} pro tento průzkum`,
  earlier: (n) => `Dřívější hovory (${String(n)})`,
  earlierAt: stampCs,
  noNumber: "bez čísla",
  questionsHeading: "Otázky, které agent položí",
  englishNote: "Hovor probíhá v angličtině, proto otázky a úvodní věta agenta zůstávají anglicky.",
  aiDrafted: "Navrhla AI, před hovorem upravte",
  rulesFallback: "Návrh od AI nebyl k dispozici, proto jde o otázky podle pravidel.",
  drafting: "Připravuji otázky z výzkumu…",
  followUp: "Doplňující otázka při vágní odpovědi: ",
  listenFor: "Na co se zaměřit (agent nečte nahlas): ",
  noQuestions: "Žádné otázky. Přidejte otázku níže.",
  question: (n) => `Otázka ${String(n)}`,
  removeQuestion: (n) => `Odebrat otázku ${String(n)}`,
  addQuestion: "Přidat otázku",
  resetToProposal: "Vrátit navržené otázky",
  firstMessage: "Co agent řekne na začátku",
  why: whyCs,
  numberLabel: "Telefonní číslo kandidáta či kandidátky",
  nameLabel: "Vaše jméno",
  agreedLabel: "Jak byl souhlas udělen",
  agreedPlaceholder: "souhlas e-mailem 8. 10.",
  consent: "Kandidát či kandidátka souhlasí s tímto hovorem i s jeho nahráváním.",
  callNow: "Zavolat teď",
  problem: {
    allUsed: (max) => `Tento průzkum už využil všechny hovory (${String(max)}).`,
    addOne: "Přidejte alespoň jednu otázku.",
    atMost: (n) => `Nejvýše ${String(n)} ${czPlural(n, "otázka", "otázky", "otázek")}.`,
    length: (min, max) => `Každá otázka musí mít ${String(min)} až ${String(max)} znaků.`,
    number: "Zadejte telefonní číslo v mezinárodním formátu, např. +420 777 123 456.",
    consent: "Potvrďte, že kandidát či kandidátka souhlasí s hovorem i s nahráváním.",
    note: "Uveďte, jak byl souhlas udělen.",
    operator: "Zadejte své jméno.",
  },
};

export const KIT_CS: KitUi = {
  heading: "Podklady k pohovoru",
  intro: "Plán, doklady a mezery v jednom dokumentu pro pohovor.",
  copyKit: "Kopírovat podklady k pohovoru",
  copied: "Zkopírováno",
  copyFailed: "Kopírování se nezdařilo",
  calendar: "Kalendář",
  addToCalendar: "Přidat pohovor do kalendáře",
  ics: " (.ics)",
  moreExports: "Další exporty",
  downloadMd: "Stáhnout .md",
  noticeLanguage: "Jazyk oznámení pro kandidáta či kandidátku",
  noticeIn: { en: "Oznámení v angličtině", cs: "Oznámení v češtině" },
  copyNotice: "Kopírovat oznámení pro kandidáta či kandidátku",
  downloadNotice: "Stáhnout oznámení (.md)",
  copyAts: "Kopírovat do ATS",
  copyRefs: "Kopírovat otázky pro reference",
  date: "Datum",
  time: "Čas (váš místní čas)",
  duration: "Délka",
  downloadIcs: "Stáhnout .ics",
  icsHint:
    "Importujte ho do Google Kalendáře nebo Outlooku a přidejte tam účastníky pohovoru. Pozvánka obsahuje shrnutí, otázky k pohovoru a odkaz na tento podklad.",
  reviewTitle: "Po pohovoru: vložte vyplněné podklady",
  reviewLabel: "Vyplněné podklady k pohovoru (Markdown)",
  reviewPlaceholder: "Po pohovoru sem vložte podklady. Body zaškrtněte pomocí [x] nebo k nim připište poznámky; nezaškrtnuté body bez poznámek zůstanou otevřené.",
  reviewPrivate: "Vaše poznámky zůstávají v tomto prohlížeči; nic se neukládá.",
  reviewCounts: (answered, questions, verified, checks) =>
    `Zodpovězené otázky k pohovoru: ${String(answered)} ${zOrZe(questions)} ${String(questions)} · ověřené body: ${String(verified)} ${zOrZe(checks)} ${String(checks)}`,
  reviewAllCovered: "Všechny body z podkladů k pohovoru byly na pohovoru probrány.",
  reviewOpen: "Stále otevřené",
  copyOpen: "Kopírovat otevřené body",
  notAKit: "Tohle nevypadá jako podklady k pohovoru z této stránky.",
  asideLabel: "Podklady k pohovoru a údaje o průzkumu",
  deleteWhen: "Udělejte to, když kandidát či kandidátka v náboru nepokračuje.",
  neverScores: "Radar připravuje doklady a lidi nikdy nehodnotí. Každé rozhodnutí dělá člověk.",
  allBriefs: "Moje podklady",
};
