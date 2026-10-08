/**
 * Deterministic CallBrief builder: turns recipe questions, gaps and weak claims into a call script.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/call-brief.ts
 * Deps:    src/domain/art9 (types from call.ts, claim.ts and recipe/step.ts)
 * Tested:  src/domain/__tests__/call-brief.test.ts
 *
 * Key responsibilities:
 * - Pick at most MAX_CALL_QUESTIONS questions: gaps first, then low-confidence or contradicted claims
 * - A gap keyed by a recipe question asks that question; a gap keyed by a source step asks about its reason
 * - Compose the full script: AI disclosure, purpose, consent, identity question, questions, closing
 * - Drop anything that touches a GDPR Art. 9 topic before it can be asked
 *
 * Design constraints:
 * - Pure and deterministic: no I/O, no LLM, same input gives the same output
 * - Never ask about Art. 9 data (shared denylist in art9.ts)
 */
import { containsArt9Topic } from "@/domain/art9";
import type { CallBrief, CallQuestion } from "@/domain/call";
import type { Claim, Gap, GoalId } from "@/domain/claim";
import type { Question } from "@/recipe/step";

export const MAX_CALL_QUESTIONS = 5;

const PURPOSE: Record<GoalId, string> = {
  hiring: "I would like to confirm a few facts for a hiring check.",
  "due-diligence": "I would like to confirm a few public facts for a due-diligence check.",
};

function identityQuestion(goal: GoalId, subject: string): string {
  return goal === "hiring"
    ? `Am I speaking with ${subject}, or with someone who can confirm facts about ${subject}?`
    : `Am I speaking with someone authorised to confirm public facts about ${subject}?`;
}

export function buildCallBrief(input: {
  goal: GoalId;
  subject: string;
  questions: readonly Question[];
  gaps: readonly Gap[];
  claims: readonly Claim[];
  language?: string;
}): CallBrief {
  const { goal, subject, language = "en" } = input;
  const picked: CallQuestion[] = [];
  const seen = new Set<string>();
  const add = (q: CallQuestion): void => {
    if (picked.length >= MAX_CALL_QUESTIONS || seen.has(q.question_id)) return;
    if (containsArt9Topic(q.text)) return;
    seen.add(q.question_id);
    picked.push(q);
  };

  const byId = new Map(input.questions.map((q) => [q.id, q]));
  for (const gap of input.gaps) {
    const q = byId.get(gap.question_id);
    // The runner keys collector gaps by step id (e.g. github_profile) with a human reason; ask about the reason.
    const text = q ? q.text : `Our public research found nothing here: ${gap.reason}. Can you confirm that, or tell me what we missed?`;
    add({ question_id: gap.question_id, text, expected: "" });
  }
  for (const claim of input.claims) {
    if (claim.confidence < 0.6 || claim.contradicts.length > 0) {
      add({
        question_id: claim.question_id,
        text: `Can you confirm the following: ${claim.text}`,
        expected: claim.text,
      });
    }
  }

  const identity = identityQuestion(goal, subject);
  const script = [
    `I am an automated AI assistant calling on behalf of a researcher using public information about ${subject}.`,
    PURPOSE[goal],
    "This call may be recorded and transcribed. Do you agree to continue?",
    "If you do not agree, I will end the call now.",
    identity,
    ...picked.map((q, i) => `${String(i + 1)}. ${q.text}`),
    "Thank you. I will not ask about anything else.",
  ].join("\n");

  return { language, identity_question: identity, questions: picked, script };
}
