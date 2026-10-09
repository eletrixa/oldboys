/**
 * The brief's own English texts with stable ids (idea #24): what the Czech report translates, and the ids it renders by.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/report-text.ts
 * Deps:    src/domain/report-translation (ReportText type), ./state, ./summary (aiOff, summaryGaps), ./challenge
 * Tested:  src/app/runs/[id]/__tests__/report-text.test.ts
 *
 * Key responsibilities:
 * - tid: one id per text (section title / reason / summary, per-question summary, question, claim text, devil's
 *   advocate reason, source confirmation reason, interview question, to-verify item, gap reason, location note,
 *   degraded reason); the renderers look translations up by the same ids
 * - reportTexts: every such text the brief area shows, only for what is shown (shown sections, their claims)
 * - The 30-second summary is never sent as a sentence (summary-cs.ts builds the Czech lines from counts): only the
 *   question texts of the criteria its "missing" line names (q:<id>); its ask line reuses iq: / tv:
 * - splitLead: "Confirmed: …" → lead + body, so the English lead word maps to the dictionary
 *
 * Design constraints:
 * - Pure, server-safe (the translate route imports it): no React
 * - Never a quote (claim.quote, headline, evidence and also_found excerpts, saved copies), a URL, a person's name or
 *   the role / position title the recruiter typed; gap reasons go in as gapText (URLs and JSON already removed)
 */
import type { ReportText } from "@/domain/report-translation";
import { challengesById } from "./challenge";
import { type RunState, briefSections, gapText, isShown, searchedEmpty } from "./state";
import { aiOff, summaryGaps } from "./summary";

export const tid = {
  sectionTitle: (id: string): string => `s:${id}:title`,
  sectionReason: (id: string): string => `s:${id}:reason`,
  sectionSummary: (id: string): string => `s:${id}:summary`,
  questionSummary: (questionId: string): string => `pq:${questionId}`,
  question: (questionId: string): string => `q:${questionId}`,
  claim: (claimId: string): string => `c:${claimId}`,
  challenge: (claimId: string): string => `ch:${claimId}`,
  sourceReason: (sourceId: string): string => `src:${sourceId}`,
  interviewQuestion: (i: number): string => `iq:${String(i)}`,
  toVerify: (i: number): string => `tv:${String(i)}`,
  searchedEmpty: (i: number): string => `se:${String(i)}`,
  notSearched: (i: number): string => `ns:${String(i)}`,
  locationNote: "loc",
  degraded: "deg",
} as const;

export type SummaryLead = "Confirmed" | "Missing" | "Ask" | "Check";
const LEADS: readonly SummaryLead[] = ["Confirmed", "Missing", "Ask", "Check"];

/** "Ask: How did …?" → { lead: "Ask", body: "How did …?" }; a sentence without a known lead has lead null. */
export function splitLead(sentence: string): { lead: SummaryLead | null; body: string } {
  const lead = LEADS.find((l) => sentence.startsWith(`${l}: `));
  return lead === undefined ? { lead: null, body: sentence } : { lead, body: sentence.slice(lead.length + 2) };
}

/** True when no model wrote the per-question summaries (the brief shows the role criteria instead). */
export function allUnavailable(brief: NonNullable<RunState["brief"]>): boolean {
  return brief.per_question.length > 0 && brief.per_question.every((q) => q.summary.startsWith("AI summary unavailable"));
}

export function reportTexts(state: RunState): ReportText[] {
  const { brief } = state;
  if (brief === null) return [];
  const out: ReportText[] = [];
  const add = (id: string, text: string | null | undefined): void => {
    const t = text?.trim() ?? "";
    if (t !== "" && !out.some((o) => o.id === id)) out.push({ id, text: t });
  };
  const questionText = new Map(state.questions.map((q) => [q.id, q.text]));

  for (const g of summaryGaps(state, brief, aiOff(brief))) if (g.kind === "criterion") add(tid.question(g.questionId), questionText.get(g.questionId));
  add(tid.locationNote, brief.location_note);
  add(tid.degraded, brief.degraded);

  const sections = briefSections(brief);
  const shownClaims = new Set<string>();
  for (const s of (sections ?? []).filter(isShown)) {
    add(tid.sectionTitle(s.id), s.title);
    add(tid.sectionReason(s.id), s.confidence_reason);
    add(tid.sectionSummary(s.id), s.summary);
    for (const id of s.claim_ids) shownClaims.add(id);
  }
  if (allUnavailable(brief)) {
    for (const q of state.questions.filter((x) => x.id.startsWith("mh-"))) add(tid.question(q.id), q.text);
  } else if (sections === null) {
    for (const q of brief.per_question) {
      add(tid.question(q.question_id), questionText.get(q.question_id));
      add(tid.questionSummary(q.question_id), q.summary);
      for (const id of q.claim_ids) shownClaims.add(id);
    }
  }

  const challenges = challengesById(state);
  const sourceReason = new Map(state.sources.map((s) => [s.id, s.identity_reason ?? null]));
  for (const c of state.claims.filter((x) => shownClaims.has(x.id))) {
    add(tid.claim(c.id), c.text);
    add(tid.challenge(c.id), challenges.get(c.id)?.why);
    for (const sid of c.supports) add(tid.sourceReason(sid), sourceReason.get(sid));
  }

  brief.interview_questions.forEach((q, i) => { add(tid.interviewQuestion(i), q); });
  brief.to_verify.forEach((t, i) => { add(tid.toVerify(i), t); });
  searchedEmpty(brief).forEach((g, i) => { add(tid.searchedEmpty(i), gapText(g.reason)); });
  brief.not_searched.forEach((g, i) => { add(tid.notSearched(i), gapText(g.reason)); });
  return out;
}
