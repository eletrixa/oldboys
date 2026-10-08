/**
 * Deterministic CallBrief builder: turns recipe questions, gaps and weak claims into a call script.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/call-brief.ts
 * Deps:    none (types from call.ts, claim.ts and recipe/step.ts)
 * Tested:  src/domain/__tests__/call-brief.test.ts
 *
 * Key responsibilities:
 * - Pick at most MAX_CALL_QUESTIONS questions: gaps first, then low-confidence or contradicted claims
 * - Compose the full script: AI disclosure, purpose, consent, identity question, questions, closing
 * - Drop anything that touches a GDPR Art. 9 topic before it can be asked
 *
 * Design constraints:
 * - Pure and deterministic: no I/O, no LLM, same input gives the same output
 * - Never ask about Art. 9 data; the denylist matches case-insensitively at the start of a word (stems allowed)
 */
import type { CallBrief, CallQuestion } from "@/domain/call";
import type { Claim, Gap, GoalId } from "@/domain/claim";
import type { Question } from "@/recipe/step";

export const MAX_CALL_QUESTIONS = 5;

/**
 * GDPR Art. 9 topics the agent must never ask about or record. English stems match whole words
 * (plus suffixes); Czech stems match at word start. Unicode-aware: `\b` is ASCII-only.
 */
export const ART9_PATTERN =
  /(?<![\p{L}])(health|medical|illness|disabilit|disabled|religio|politic|political part|ethnic|race|racial|sexual|sexuality|orientation|trade union|union member|biometric|genetic|zdravot|nemoc|nábožen|politick|etnick|sexuál|odbor)\p{L}*/iu;

export function containsArt9Topic(text: string): boolean {
  return ART9_PATTERN.test(text);
}

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
    if (q) add({ question_id: q.id, text: q.text, expected: "" });
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
