/**
 * Labels of the finished brief layout (header, steps, 30-second numbers, "Before the interview", tabs, plan, gap groups) in English and Czech.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/brief-ui-text.ts
 * Deps:    src/domain/call (type), ./brief-layout (types)
 * Tested:  src/app/runs/[id]/__tests__/i18n.test.ts (both languages have the same keys, no verdict words)
 *
 * Key responsibilities:
 * - BriefUi: one typed object per language, reached as `report.t.ui` (REPORT_DICT in i18n.ts)
 * - Czech: formal, gender-neutral; the words describe the research and the process, never the person
 *
 * Design constraints:
 * - Pure data; the phone panel and the kit sidebar stay English (lang="en") like before
 */
import type { CallAnswerStatus } from "@/domain/call";
import type { GapGroup, HiringStep } from "./brief-layout";

export type BriefUi = {
  eyebrow: string;
  identityPill: (n: number) => string;
  noIdentity: string;
  phonePill: (day: string) => string;
  stepsLabel: string;
  step: Record<HiringStep["key"], string>;
  identityDetail: (n: number) => string;
  phoneNotYet: string;
  interviewNext: string;
  interviewLater: string;
  decisionByPerson: string;
  criteriaKey: (researchQuestions: boolean) => string;
  ofN: (n: number) => string;
  criteriaOff: string;
  criteriaInPlan: (n: number) => string;
  phoneKey: string;
  answeredOf: (n: number) => string;
  noAnswerCount: (n: number) => string;
  unclearCount: (n: number) => string;
  noCall: string;
  noCallHint: string;
  seeAnswers: string;
  setUpCall: string;
  backgroundKey: string;
  facts: (n: number) => string;
  inferencesToVerify: (n: number) => string;
  gapsCount: (n: number) => string;
  seeEvidence: string;
  sentences: string;
  before: string;
  compare: string;
  publicSource: string;
  phoneAt: (at: string | null) => string;
  saidByCandidate: string;
  sourcesDisagree: string;
  contradictionsTitle: (n: number) => string;
  noEvidenceTitle: (x: number, n: number) => string;
  noEvidencePill: string;
  gapNotPerson: string;
  inferencesPill: (n: number) => string;
  inferencesTitle: string;
  devilsAdvocatePill: string;
  askQuestion: (n: number) => string;
  askQuestions: (a: number, b: number) => string;
  tabsLabel: string;
  tab: { plan: string; evidence: string; call: string; sources: string };
  planIntro: string;
  covered: string;
  coveredCount: (x: number, n: number) => string;
  groupCriteria: (role: string | null) => string;
  groupVerify: string;
  groupSuggested: string;
  whyNone: string;
  whyPartial: string;
  whyFrom: (kind: "INFERENCE" | "FACT" | "STATEMENT" | null, host: string) => string;
  topicVerify: string;
  phone: string;
  notAskedByPhone: string;
  at: (t: string) => string;
  answerStatus: Record<CallAnswerStatus, string>;
  emptyPlan: string;
  criterion: string;
  research: string;
  lookedFor: string;
  roleCriteria: string;
  careerTitle: string;
  careerIntro: string;
  datesNotStated: string;
  present: string;
  findings: string;
  claimsCount: (n: number) => string;
  confirmedProfiles: string;
  noConfirmedProfiles: string;
  howConfirmed: (first: string) => string;
  gapsTitle: string;
  gapsIntro: string;
  gapGroup: Record<GapGroup, string>;
};

const plural = (n: number, one: string, many: string): string => `${String(n)} ${n === 1 ? one : many}`;

export const UI_EN: BriefUi = {
  eyebrow: "Candidate brief",
  identityPill: (n) => `Identity confirmed · ${plural(n, "profile", "profiles")}`,
  noIdentity: "No profile confirmed",
  phonePill: (day) => `Phone screen done${day === "" ? "" : ` · ${day}`}`,
  stepsLabel: "Hiring steps",
  step: { research: "Research", identity: "Identity", phone: "Phone screen", interview: "Interview", decision: "Decision" },
  identityDetail: (n) => (n === 0 ? "No profile confirmed" : `${plural(n, "profile", "profiles")} confirmed`),
  phoneNotYet: "Not yet",
  interviewNext: "Next step",
  interviewLater: "After the phone screen",
  decisionByPerson: "Made by a person",
  criteriaKey: (rq) => (rq ? "Research questions with public evidence" : "Role criteria with public evidence"),
  ofN: (n) => `of ${String(n)}`,
  criteriaOff: "Not checked: the AI step was off",
  criteriaInPlan: (n) => (n === 0 ? "" : `${plural(n, "criterion is", "criteria are")} in the interview plan.`),
  phoneKey: "Phone screen",
  answeredOf: (n) => `of ${String(n)} answered`,
  noAnswerCount: (n) => `${plural(n, "question", "questions")} had no answer`,
  unclearCount: (n) => `${plural(n, "answer was", "answers were")} unclear`,
  noCall: "No phone screen yet",
  noCallHint: "An AI agent can ask the open questions before the interview.",
  seeAnswers: "See the answers",
  setUpCall: "Set up a call",
  backgroundKey: "Background found",
  facts: (n) => (n === 1 ? "fact" : "facts"),
  inferencesToVerify: (n) => `${plural(n, "inference", "inferences")} still to verify`,
  gapsCount: (n) => `${plural(n, "source", "sources")} had nothing or were not searched`,
  seeEvidence: "See the evidence",
  sentences: "In sentences",
  before: "Before the interview",
  compare: "Compare",
  publicSource: "Public source",
  phoneAt: (at) => (at === null ? "Phone screen" : `Phone screen · at ${at}`),
  saidByCandidate: "Said by the candidate. Not public evidence.",
  sourcesDisagree: "Sources disagree",
  contradictionsTitle: (n) => `${plural(n, "finding conflicts", "findings conflict")} with another source`,
  noEvidenceTitle: (x, n) => `No public evidence for ${String(x)} of ${String(n)} role criteria`,
  noEvidencePill: "No public evidence",
  gapNotPerson: "This is a gap in the research, not a fact about the person.",
  inferencesPill: (n) => plural(n, "inference", "inferences"),
  inferencesTitle: "Not confirmed by a direct source",
  devilsAdvocatePill: "Double-checked",
  askQuestion: (n) => `Ask in the interview: question ${String(n)}`,
  askQuestions: (a, b) => (a === b ? `Ask in the interview: question ${String(a)}` : `Ask in the interview: questions ${String(a)} to ${String(b)}`),
  tabsLabel: "Brief details",
  tab: { plan: "Interview plan", evidence: "Evidence", call: "Phone screen", sources: "Sources and gaps" },
  planIntro: "One list: what to ask, why, and what the candidate already said on the phone.",
  covered: "Covered",
  coveredCount: (x, n) => `${String(x)} of ${String(n)} covered`,
  groupCriteria: (role) => (role === null ? "Role criteria" : `Role criteria · ${role}`),
  groupVerify: "To verify · from the research",
  groupSuggested: "Interview questions · from the research",
  whyNone: "Why: no public evidence",
  whyPartial: "Why: only partial public evidence",
  whyFrom: (kind, host) => (kind === "INFERENCE" ? `Why: inference from ${host}` : `Why: check with the candidate (${host})`),
  topicVerify: "To verify",
  phone: "Phone",
  notAskedByPhone: "Not asked by phone",
  at: (t) => `at ${t}`,
  answerStatus: { answered: "Answered", unclear: "Unclear", declined: "Declined", no_answer: "No answer", not_asked: "Not asked" },
  emptyPlan: "Nothing to ask from the research. Use your own questions.",
  criterion: "Criterion",
  research: "Research",
  lookedFor: "What we looked for",
  roleCriteria: "Role criteria",
  careerTitle: "Career at a glance",
  careerIntro: "Dates as the profile lists them (self-reported). Overlapping bars are roles held at the same time.",
  datesNotStated: "Dates not stated",
  present: "present",
  findings: "Findings by topic",
  claimsCount: (n) => plural(n, "claim", "claims"),
  confirmedProfiles: "Confirmed profiles",
  noConfirmedProfiles: "No profile was confirmed as theirs.",
  howConfirmed: (first) => `How we confirmed it is ${first}`,
  gapsTitle: "Gaps in the research",
  gapsIntro: "Sources that gave us nothing. A gap says nothing about the person.",
  gapGroup: {
    "nothing-found": "Searched, nothing found",
    namesake: "Searched, only people with the same name",
    "no-handle": "Not searched: no confirmed account to look up",
    busy: "Not searched: the service refused or was busy",
    timeout: "Not searched: the service did not answer in time",
    budget: "Not searched: the research budget was used up",
    login: "Not searched: needs a login",
    other: "Not searched, other reasons",
  },
};

/** Czech plural for counts: 1 / 2–4 / 5+. */
const cz = (n: number, one: string, few: string, many: string): string => `${String(n)} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;

export const UI_CS: BriefUi = {
  eyebrow: "Podklad ke kandidatuře",
  identityPill: (n) => `Totožnost potvrzena · ${cz(n, "profil", "profily", "profilů")}`,
  noIdentity: "Žádný profil nepotvrzen",
  phonePill: (day) => `Telefonický screening proběhl${day === "" ? "" : ` · ${day}`}`,
  stepsLabel: "Kroky náboru",
  step: { research: "Výzkum", identity: "Totožnost", phone: "Telefonický screening", interview: "Pohovor", decision: "Rozhodnutí" },
  identityDetail: (n) => (n === 0 ? "Žádný profil nepotvrzen" : `Potvrzeno: ${cz(n, "profil", "profily", "profilů")}`),
  phoneNotYet: "Zatím ne",
  interviewNext: "Další krok",
  interviewLater: "Po telefonickém screeningu",
  decisionByPerson: "Rozhoduje člověk",
  criteriaKey: (rq) => (rq ? "Výzkumné otázky s veřejným dokladem" : "Kritéria pozice s veřejným dokladem"),
  ofN: (n) => `z ${String(n)}`,
  criteriaOff: "Neověřeno: AI krok neběžel",
  criteriaInPlan: (n) => (n === 0 ? "" : `V plánu pohovoru: ${cz(n, "kritérium", "kritéria", "kritérií")}.`),
  phoneKey: "Telefonický screening",
  answeredOf: (n) => `z ${String(n)} zodpovězeno`,
  noAnswerCount: (n) => `Bez odpovědi: ${cz(n, "otázka", "otázky", "otázek")}`,
  unclearCount: (n) => `Nejasné odpovědi: ${String(n)}`,
  noCall: "Telefonický screening zatím neproběhl",
  noCallHint: "AI agent se může na otevřené otázky zeptat ještě před pohovorem.",
  seeAnswers: "Zobrazit odpovědi",
  setUpCall: "Připravit hovor",
  backgroundKey: "Nalezené pozadí",
  facts: (n) => (n === 1 ? "fakt" : n >= 2 && n <= 4 ? "fakta" : "faktů"),
  inferencesToVerify: (n) => `K ověření zbývá: ${cz(n, "odvození", "odvození", "odvození")}`,
  gapsCount: (n) => `Bez výsledku nebo neprohledáno: ${cz(n, "zdroj", "zdroje", "zdrojů")}`,
  seeEvidence: "Zobrazit doklady",
  sentences: "Ve větách",
  before: "Před pohovorem",
  compare: "Porovnat",
  publicSource: "Veřejný zdroj",
  phoneAt: (at) => (at === null ? "Telefonický screening" : `Telefonický screening · v ${at}`),
  saidByCandidate: "Řekla to kandidátská osoba. Nejde o veřejný doklad.",
  sourcesDisagree: "Zdroje se liší",
  contradictionsTitle: (n) => `V rozporu s jiným zdrojem: ${cz(n, "zjištění", "zjištění", "zjištění")}`,
  noEvidenceTitle: (x, n) => `Bez veřejného dokladu: ${String(x)} ${n >= 2 && n <= 4 ? "ze" : "z"} ${String(n)} kritérií pozice`,
  noEvidencePill: "Bez veřejného dokladu",
  gapNotPerson: "Jde o mezeru ve výzkumu, ne o fakt o člověku.",
  inferencesPill: (n) => cz(n, "odvození", "odvození", "odvození"),
  inferencesTitle: "Nepotvrzeno přímým zdrojem",
  devilsAdvocatePill: "Dvojí kontrola",
  askQuestion: (n) => `Zeptejte se u pohovoru: otázka ${String(n)}`,
  askQuestions: (a, b) => (a === b ? `Zeptejte se u pohovoru: otázka ${String(a)}` : `Zeptejte se u pohovoru: otázky ${String(a)} až ${String(b)}`),
  tabsLabel: "Podrobnosti podkladu",
  tab: { plan: "Plán pohovoru", evidence: "Doklady", call: "Telefonický screening", sources: "Zdroje a mezery" },
  planIntro: "Jeden seznam: na co se zeptat, proč a co už zaznělo v telefonu.",
  covered: "Probráno",
  coveredCount: (x, n) => `Probráno ${String(x)} z ${String(n)}`,
  groupCriteria: (role) => (role === null ? "Kritéria pozice" : `Kritéria pozice · ${role}`),
  groupVerify: "K ověření · z výzkumu",
  groupSuggested: "Otázky k pohovoru · z výzkumu",
  whyNone: "Proč: bez veřejného dokladu",
  whyPartial: "Proč: jen částečný veřejný doklad",
  whyFrom: (kind, host) => (kind === "INFERENCE" ? `Proč: odvozeno ze zdroje ${host}` : `Proč: ověřte s kandidátskou osobou (${host})`),
  topicVerify: "K ověření",
  phone: "Telefon",
  notAskedByPhone: "V telefonu nezaznělo",
  at: (t) => `v ${t}`,
  answerStatus: { answered: "Zodpovězeno", unclear: "Nejasné", declined: "Odmítnuto", no_answer: "Bez odpovědi", not_asked: "Nepoloženo" },
  emptyPlan: "Z výzkumu nevyplývá žádná otázka. Použijte vlastní otázky.",
  criterion: "Kritérium",
  research: "Výzkum",
  lookedFor: "Co jsme hledali",
  roleCriteria: "Kritéria pozice",
  careerTitle: "Kariéra v přehledu",
  careerIntro: "Data tak, jak je uvádí profil (uvedeno samotnou osobou). Překrývající se pruhy jsou souběžné role.",
  datesNotStated: "Data neuvedena",
  present: "dosud",
  findings: "Zjištění podle témat",
  claimsCount: (n) => cz(n, "tvrzení", "tvrzení", "tvrzení"),
  confirmedProfiles: "Potvrzené profily",
  noConfirmedProfiles: "Žádný profil nebyl potvrzen jako tatáž osoba.",
  howConfirmed: (first) => `Jak jsme ověřili, že jde o osobu ${first}`,
  gapsTitle: "Mezery ve výzkumu",
  gapsIntro: "Zdroje, které nic nepřinesly. Mezera o člověku nic neříká.",
  gapGroup: {
    "nothing-found": "Prohledáno, nic nenalezeno",
    namesake: "Prohledáno, jen lidé se stejným jménem",
    "no-handle": "Neprohledáno: žádný potvrzený účet",
    busy: "Neprohledáno: služba odmítla nebo byla přetížená",
    timeout: "Neprohledáno: služba neodpověděla včas",
    budget: "Neprohledáno: rozpočet výzkumu došel",
    login: "Neprohledáno: vyžaduje přihlášení",
    other: "Neprohledáno, jiné důvody",
  },
};
