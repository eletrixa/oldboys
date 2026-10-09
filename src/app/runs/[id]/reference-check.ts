/**
 * "Copy reference questions": research gaps turned into plain-text questions for a former manager or colleague (idea #18).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/reference-check.ts
 * Deps:    src/domain/art9 (containsArt9Topic), ./summary (aiOff, shorten), ./state (RunState, hiringFor), ./cv-check, ./i18n (Report), ./report-text (tid)
 * Tested:  src/app/runs/[id]/__tests__/reference-check.test.ts, src/app/runs/[id]/__tests__/cv-check.test.ts (CV check)
 *
 * Key responsibilities:
 * - referenceQuestions: header, at most 8 numbered questions and a consent / private-topics footer, or null while
 *   there is no brief
 * - Normal brief: role criteria (mh-) with no or partial evidence; degraded brief (AI off): every role criterion,
 *   because none was checked; then each to-verify item
 * - Report language (idea #24): with a Czech Report the fixed strings are formal, gender-neutral Czech (no name, so no
 *   declension) and criteria / to-verify texts use the brief's translations (tid.question, tid.toVerify; English when
 *   missing); the subject and the role / position title stay as typed; English output is unchanged
 *
 * Design constraints:
 * - Pure and deterministic; plain text only (works in e-mail, notes and any ATS)
 * - Gaps only: never brief.also_found, unconfirmed candidates, claims or interview_questions (those are for the candidate)
 * - CV differences (idea #14) are never put to a referee: they would disclose the candidate's CV and are asked in the
 *   interview first ("ask, don't assume"), so their to-verify items are skipped (cvDifferenceTexts)
 * - Rates the research, never the candidate: no scores, ranks or traits; Art. 9 topics dropped as defense in depth
 *   (checked on the English text and on the copied wording)
 */
import { containsArt9Topic } from "@/domain/art9";
import { cvDifferenceTexts } from "./cv-check";
import { ENGLISH_REPORT, type Report } from "./i18n";
import { tid } from "./report-text";
import { hiringFor, type RunState } from "./state";
import { aiOff, shorten } from "./summary";

/** Most questions in the list; a reference call is short. */
const MAX_QUESTIONS = 8;

/** The fixed wording of the list in one language; `first` is the subject's first name or "the candidate". */
type Wording = {
  header: (subject: string, role: string) => string;
  intro: string;
  notChecked: (label: string, first: string) => string;
  none: (label: string, first: string) => string;
  partial: (label: string, first: string) => string;
  confirm: (item: string) => string;
  fallback: (first: string) => string;
  footer: string;
};

const followUp = (name: string): string => `Did you see ${name} do this at work? Can you give an example?`;

const EN: Wording = {
  header: (subject, role) => (role === "" ? `Reference check: ${subject}` : `Reference check: ${subject} for ${role}`),
  intro: "Questions for a former manager or colleague. Ask only about work they saw first-hand.",
  notChecked: (label, name) => `Did you see ${name} work on "${label}"? Can you give an example?`,
  none: (label, name) => `We found no public evidence for "${label}". ${followUp(name)}`,
  partial: (label, name) => `We found only partial public evidence for "${label}". ${followUp(name)}`,
  confirm: (item) => `Can you confirm: ${item}?`,
  fallback: (first) => `The research left no open points. Ask the referee to describe one project ${first} owned and their part in it.`,
  footer:
    "Contact references only with the candidate's consent. Never ask about health, family, beliefs, politics, union " +
    "membership or other private topics. Note what the referee saw, not what they think of the person.",
};

/** Formal ("Vy"), gender-neutral Czech; no name in the questions, because Czech would need it declined. */
const FOLLOW_UP_CS = "Máte z práce přímou zkušenost, která to ukazuje? Můžete uvést příklad?";

const CS: Wording = {
  header: (subject, role) => (role === "" ? `Reference: ${subject}` : `Reference: ${subject}, pozice ${role}`),
  intro: "Otázky pro bývalé vedení nebo kolegy a kolegyně z předchozí práce. Ptejte se jen na práci, kterou znají z první ruky.",
  notChecked: (label) => `Kritérium „${label}“ průzkum neověřoval. ${FOLLOW_UP_CS}`,
  none: (label) => `Pro „${label}“ jsme ve veřejných zdrojích nenašli žádný doklad. ${FOLLOW_UP_CS}`,
  partial: (label) => `Pro „${label}“ jsme ve veřejných zdrojích našli jen částečné doklady. ${FOLLOW_UP_CS}`,
  confirm: (item) => `Můžete potvrdit: ${item}?`,
  fallback: () =>
    "Průzkum nenechal žádné otevřené body. Zeptejte se: Můžete popsat jeden projekt, za který tato osoba odpovídala, " +
    "a jaká v něm byla Vaše role?",
  footer:
    "Reference kontaktujte jen se souhlasem kandidující osoby. Nikdy se neptejte na zdraví, rodinu, přesvědčení, " +
    "politické názory, členství v odborech ani jiná soukromá témata. Zapište si, co reference zná z první ruky, ne co si " +
    "o daném člověku myslí.",
};

/** The questions in order: criteria first, then to-verify items; Art. 9 topics dropped, deduplicated, capped. */
function questions(state: RunState, name: string, w: Wording, report: Report): string[] {
  const { brief } = state;
  if (brief === null) return [];
  const coverage = new Map(brief.per_question.map((q) => [q.question_id, q.coverage]));
  const off = aiOff(brief);
  const criteria = state.questions
    .filter((q) => q.id.startsWith("mh-"))
    .map((q) => {
      const english = q.title !== undefined && q.title.trim() !== "" ? q.title : q.text;
      if (shorten(english) === "") return null;
      const label = shorten(report.text(tid.question(q.id), english));
      const cov = coverage.get(q.id);
      const question = off ? w.notChecked(label, name) : cov === "none" ? w.none(label, name) : cov === "partial" ? w.partial(label, name) : null;
      return question === null ? null : { english, question };
    })
    .filter((q) => q !== null);
  const cvItems = cvDifferenceTexts(state);
  const checks = brief.to_verify
    .map((t, i) => ({ english: t, text: report.text(tid.toVerify(i), t) }))
    .filter((t) => !cvItems.has(t.english) && shorten(t.english) !== "")
    .map((t) => ({ english: t.english, question: w.confirm(shorten(t.text)) }));
  const all = [...criteria, ...checks]
    .filter((q) => !containsArt9Topic(q.english) && !containsArt9Topic(q.question))
    .map((q) => q.question);
  return [...new Set(all)].slice(0, MAX_QUESTIONS);
}

/** The plain-text list, or null while there is no brief; Czech when `report` is the Czech one. */
export function referenceQuestions(state: RunState, report: Report = ENGLISH_REPORT): string | null {
  if (state.brief === null) return null;
  const cs = report.lang === "cs";
  const w = cs ? CS : EN;
  const subject = state.subject.trim() === "" ? (cs ? "jméno neuvedeno" : "unnamed person") : state.subject.trim();
  const role = hiringFor(state)?.trim() ?? "";
  const name = state.subject.trim().split(/\s+/)[0] ?? "";
  const first = name === "" ? "the candidate" : name;
  const list = questions(state, first, w, report);
  const body = list.length === 0 ? [w.fallback(first)] : list.map((q, i) => `${String(i + 1)}. ${q}`);
  return [w.header(subject, role), w.intro, "", ...body, w.footer].join("\n");
}
