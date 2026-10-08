/**
 * "Copy reference questions": research gaps turned into plain-text questions for a former manager or colleague (idea #18).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/reference-check.ts
 * Deps:    src/domain/art9 (containsArt9Topic), ./summary (aiOff, shorten), ./state (RunState)
 * Tested:  src/app/runs/[id]/__tests__/reference-check.test.ts
 *
 * Key responsibilities:
 * - referenceQuestions: header, at most 8 numbered questions and a consent / private-topics footer, or null while
 *   there is no brief
 * - Normal brief: role criteria (mh-) with no or partial evidence; degraded brief (AI off): every role criterion,
 *   because none was checked; then each to-verify item
 *
 * Design constraints:
 * - Pure and deterministic; plain text only (works in e-mail, notes and any ATS)
 * - Gaps only: never brief.also_found, unconfirmed candidates, claims or interview_questions (those are for the candidate)
 * - Rates the research, never the candidate: no scores, ranks or traits; Art. 9 topics dropped as defense in depth
 */
import { containsArt9Topic } from "@/domain/art9";
import type { RunState } from "./state";
import { aiOff, shorten } from "./summary";

/** Most questions in the list; a reference call is short. */
const MAX_QUESTIONS = 8;

const INTRO = "Questions for a former manager or colleague. Ask only about work they saw first-hand.";

const FOOTER =
  "Contact references only with the candidate's consent. Never ask about health, family, beliefs, politics, union " +
  "membership or other private topics. Note what the referee saw, not what they think of the person.";

/** The questions in order: criteria first, then to-verify items; Art. 9 topics dropped, deduplicated, capped. */
function questions(state: RunState, name: string): string[] {
  const { brief } = state;
  if (brief === null) return [];
  const coverage = new Map(brief.per_question.map((q) => [q.question_id, q.coverage]));
  const off = aiOff(brief);
  const followUp = `Did you see ${name} do this at work? Can you give an example?`;
  const criteria = state.questions
    .filter((q) => q.id.startsWith("mh-"))
    .map((q) => {
      const label = shorten(q.title !== undefined && q.title.trim() !== "" ? q.title : q.text);
      if (label === "") return null;
      if (off) return `Did you see ${name} work on "${label}"? Can you give an example?`;
      const cov = coverage.get(q.id);
      if (cov === "none") return `We found no public evidence for "${label}". ${followUp}`;
      if (cov === "partial") return `We found only partial public evidence for "${label}". ${followUp}`;
      return null;
    })
    .filter((q) => q !== null);
  const checks = brief.to_verify
    .map((t) => shorten(t))
    .filter((t) => t !== "")
    .map((t) => `Can you confirm: ${t}?`);
  const all = [...criteria, ...checks].filter((q) => !containsArt9Topic(q));
  return [...new Set(all)].slice(0, MAX_QUESTIONS);
}

/** The plain-text list, or null while there is no brief. */
export function referenceQuestions(state: RunState): string | null {
  if (state.brief === null) return null;
  const subject = state.subject.trim() === "" ? "unnamed person" : state.subject.trim();
  const role = state.role?.trim() ?? "";
  const name = state.subject.trim().split(/\s+/)[0] ?? "";
  const first = name === "" ? "the candidate" : name;
  const list = questions(state, first);
  const body =
    list.length === 0
      ? [`The research left no open points. Ask the referee to describe one project ${first} owned and their part in it.`]
      : list.map((q, i) => `${String(i + 1)}. ${q}`);
  return [
    role === "" ? `Reference check: ${subject}` : `Reference check: ${subject} for ${role}`,
    INTRO,
    "",
    ...body,
    FOOTER,
  ].join("\n");
}
