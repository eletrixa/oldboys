/**
 * CV consistency check (idea #14): the `cv-consistency` question, the CV source test and the outcome of one CV claim.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/cv-check.ts
 * Deps:    src/domain/claim (types)
 * Tested:  src/domain/__tests__/cv-check.test.ts
 *
 * Key responsibilities:
 * - withCvQuestion: appends CV_QUESTION to a hiring run's questions only when the pasted CV is among its sources
 *   (actor "cv" or URL "cv:<runId>"); runs without a CV keep exactly their questions
 * - cvOutcome: matches (FACT on a public source) / differs (INFERENCE citing a public source) / not-found (cites only the CV)
 * - cvInterviewQuestion: one neutral interview question from a difference claim ("CV: … Public LinkedIn: …")
 *
 * Design constraints:
 * - Pure; shared by the recipe seams and the report UI so both classify a claim the same way
 * - A difference is a question for the interview, never a verdict: no wording about lies, fakes or trust
 */
import type { Claim } from "@/domain/claim";

export const CV_ACTOR = "cv";
export const CV_QUESTION_ID = "cv-consistency";
export const CV_QUESTION = { id: CV_QUESTION_ID, text: "Do the CV's roles, employers, dates and projects match the public sources?" } as const;

/** The candidate's pasted or uploaded CV, stored by the seed seam as actor "cv" with URL "cv:<runId>". */
export function isCvSource(s: { url: string; actor?: string }): boolean {
  return s.actor === CV_ACTOR || s.url.startsWith("cv:");
}

/** The questions plus `cv-consistency` for a hiring run that has a CV source; anything else is returned unchanged. */
export function withCvQuestion<Q extends { id: string; text: string }>(
  goal: string,
  questions: readonly Q[],
  sources: readonly { url: string; actor?: string }[],
): (Q | typeof CV_QUESTION)[] {
  if (goal !== "hiring" || !sources.some(isCvSource) || questions.some((q) => q.id === CV_QUESTION_ID)) return [...questions];
  return [...questions, CV_QUESTION];
}

export type CvOutcome = "matches" | "differs" | "not-found";

/** Display order: what matches, then what to ask about, then what no public source mentions. */
export const CV_OUTCOMES: readonly CvOutcome[] = ["matches", "differs", "not-found"];

/**
 * Outcome of one `cv-consistency` claim. `cvIds` are the run's CV source ids; a claim citing only the CV was not
 * found publicly, whatever its kind (verify already downgrades a FACT quoted from the CV alone).
 */
export function cvOutcome(claim: Pick<Claim, "kind" | "supports">, cvIds: ReadonlySet<string>): CvOutcome {
  if (!claim.supports.some((sid) => !cvIds.has(sid))) return "not-found";
  return claim.kind === "FACT" ? "matches" : "differs";
}

const tidy = (text: string): string => text.trim().replace(/[\s.;:,]+$/, "");

/**
 * "Your CV lists: team lead at X from 2020. The public LinkedIn shows: team lead at X from 2022. Could you walk us
 * through it?" from a claim in the extract format "CV: <a>. Public <platform>: <b>."; other wording is quoted as is.
 */
export function cvInterviewQuestion(text: string): string {
  const m = /^CV:\s*(.+?)\.\s+Public\s+([^:]{1,40}):\s*(.+)$/su.exec(text.trim());
  if (m === null) return `About your CV: ${tidy(text)}. Could you walk us through it?`;
  return `Your CV lists: ${tidy(m[1] ?? "")}. The public ${tidy(m[2] ?? "")} shows: ${tidy(m[3] ?? "")}. Could you walk us through it?`;
}
