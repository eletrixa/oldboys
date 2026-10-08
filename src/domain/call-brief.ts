/**
 * Deterministic CallBrief builder: turns the brief, recipe questions, gaps and weak claims into a call script.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/call-brief.ts
 * Deps:    src/domain/art9 (types from call.ts, claim.ts and recipe/step.ts)
 * Tested:  src/domain/__tests__/call-brief.test.ts
 *
 * Key responsibilities:
 * - Pick at most MAX_CALL_QUESTIONS questions: role must-haves without evidence, then with partial evidence,
 *   then the brief's "to verify" items, then gaps, then low-confidence or contradicted claims
 * - A gap keyed by a recipe question asks that question; a gap keyed by a source step asks about its reason
 * - composeCallBrief: the script (display), the agent's first message (AI disclosure, purpose, recording,
 *   skip/stop, consent question) and the agent system prompt (steps, questions in order, rules)
 * - briefFromHrQuestions: the operator's edited questions, validated (1–5, 5–300 chars, no Art. 9 topic)
 * - Drop anything that touches a GDPR Art. 9 topic before it can be asked
 *
 * Design constraints:
 * - Pure and deterministic: no I/O, no LLM, same input gives the same output
 * - Never ask about Art. 9 data (shared denylist in art9.ts); an operator question that touches one is an
 *   error with its index, never a silent drop
 * - Without a brief the selection is gaps then weak claims, exactly as before the brief existed
 */
import { containsArt9Topic } from "@/domain/art9";
import type { CallBrief, CallQuestion } from "@/domain/call";
import type { Brief, Claim, Gap, GoalId } from "@/domain/claim";
import type { Question } from "@/recipe/step";

export const MAX_CALL_QUESTIONS = 5;
export const HR_QUESTION_MIN = 5;
export const HR_QUESTION_MAX = 300;

const PURPOSE: Record<GoalId, string> = {
  hiring: "I would like to confirm a few facts for a hiring check.",
  "due-diligence": "I would like to confirm a few public facts for a due-diligence check.",
};

const CONSENT_CLOSE =
  "it takes about three minutes. This call is recorded and transcribed, and you can skip any question or stop at any time. Is now a good time, and do you agree to continue?";

/** One line, at most `max` characters: operator-entered text must not add structure to the agent prompt. */
function oneLine(text: string, max: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

function roleOf(role: string | null): string | null {
  const r = role === null ? "" : oneLine(role, 100);
  return r === "" ? null : r;
}

function nameOf(subject: string): string {
  const s = oneLine(subject, 100);
  return s === "" ? "the candidate" : s;
}

function identityQuestion(goal: GoalId, subject: string): string {
  // Hiring calls only the candidate, never a third person.
  return goal === "hiring"
    ? `Am I speaking with ${subject}?`
    : `Am I speaking with someone authorised to confirm public facts about ${subject}?`;
}

function firstMessage(goal: GoalId, subject: string, role: string | null): string {
  if (goal === "due-diligence") {
    return `Hello, this is an automated AI assistant calling on behalf of a researcher. I would like to confirm a few public facts about ${subject} for a due-diligence check, ${CONSENT_CLOSE}`;
  }
  const team = role === null ? "a hiring team" : `the hiring team for the ${role} role`;
  return `Hello, this is an automated AI assistant calling on behalf of ${team}. I would like to check a few points from our research of public information about you, ${CONSENT_CLOSE}`;
}

function agentPrompt(goal: GoalId, subject: string, role: string | null, identity: string, questions: readonly CallQuestion[]): string {
  const hiring = goal === "hiring";
  const team = hiring ? (role === null ? "a hiring team" : `the hiring team for the ${role} role`) : "a researcher doing a due-diligence check";
  const callee = hiring ? `${subject}, a candidate` : `someone who can confirm public facts about ${subject}`;
  const reviewer = hiring ? "a person from the hiring team" : "a person from the research team";
  return [
    "# Role",
    `You are an automated AI assistant making a short verification phone call in English on behalf of ${team}.`,
    "",
    "# Context",
    `You are calling ${callee}. Public information was researched and a few points need to be checked directly.`,
    "Your first message already said that you are an AI, why you call, that the call is recorded and transcribed, and asked for consent.",
    "",
    "# Steps",
    "1. Wait for the answer to your first message. If the callee does not agree, or says it is a bad time, thank them, say goodbye and use the end_call tool.",
    `2. Ask: "${identity}" If the answer is no, apologise, share nothing about the research, say goodbye and use the end_call tool.`,
    "3. Ask the questions below one at a time, in this order, and wait for each answer. Ask at most one short follow-up per question when the answer is unclear. If the callee does not want to answer, say \"No problem\" and move to the next question.",
    `4. After the last question, thank them, say that ${reviewer} will review the answers, say goodbye and use the end_call tool.`,
    "",
    "# Questions",
    ...(questions.length === 0 ? ["(none: thank them and end the call after the identity question)"] : questions.map((q, i) => `${String(i + 1)}. ${q.text}`)),
    "",
    "# Rules",
    "- Never evaluate, judge or comment on the answers; just thank them and move on.",
    "- Say nothing about the hiring decision, salary or other candidates.",
    "- Never ask about personal topics: health, family, religion, politics, ethnicity, sexuality, age or union membership. If the callee raises one, do not follow up.",
    "- Do not invent or reveal what the research found beyond the question text.",
    "- Keep your turns short and the whole call under 5 minutes.",
    "- If you reach voicemail, leave no message and use the end_call tool.",
  ].join("\n");
}

/** Script, first message and agent prompt for a fixed list of questions; the one place the call wording lives. */
export function composeCallBrief(input: {
  goal: GoalId;
  subject: string;
  role: string | null;
  questions: readonly CallQuestion[];
  language?: string;
}): CallBrief {
  const { goal, language = "en" } = input;
  const subject = nameOf(input.subject);
  const role = goal === "hiring" ? roleOf(input.role) : null;
  const questions = [...input.questions];
  const identity = identityQuestion(goal, subject);
  const script = [
    `I am an automated AI assistant calling on behalf of a researcher using public information about ${subject}.`,
    PURPOSE[goal],
    "This call may be recorded and transcribed. Do you agree to continue?",
    "If you do not agree, I will end the call now.",
    identity,
    ...questions.map((q, i) => `${String(i + 1)}. ${q.text}`),
    "Thank you. I will not ask about anything else.",
  ].join("\n");
  return {
    language,
    identity_question: identity,
    questions,
    script,
    first_message: firstMessage(goal, subject, role),
    agent_prompt: agentPrompt(goal, subject, role, identity, questions),
  };
}

/** Must-haves (ids "mh-") the brief found no or only partial evidence for, none first. */
function coverageQuestions(brief: Brief, questions: readonly Question[]): CallQuestion[] {
  const titleOf = new Map(questions.map((q) => [q.id, q.title ?? q.text]));
  const pick = (coverage: "none" | "partial"): CallQuestion[] =>
    brief.per_question.flatMap((p) => {
      const title = titleOf.get(p.question_id);
      if (!p.question_id.startsWith("mh-") || p.coverage !== coverage || title === undefined) return [];
      const name = oneLine(title, 200).replace(/[.?!]+$/, "");
      return coverage === "none"
        ? [{ question_id: p.question_id, text: `Can you tell me about your experience with ${name}? We could not find public evidence for it.`, expected: "", why: `No public evidence: ${name}` }]
        : [{ question_id: p.question_id, text: `Can you tell me more about ${name}? We found only partial public evidence.`, expected: "", why: `Partial evidence: ${name}` }];
    });
  return [...pick("none"), ...pick("partial")];
}

function toVerifyQuestions(brief: Brief): CallQuestion[] {
  return brief.to_verify.map((text, i) => {
    const point = oneLine(text, 250).replace(/[.?!]+$/, "");
    return { question_id: `tv-${String(i + 1)}`, text: `Our research suggests: ${point}. Is that correct?`, expected: point, why: "To verify" };
  });
}

export function buildCallBrief(input: {
  goal: GoalId;
  subject: string;
  questions: readonly Question[];
  gaps: readonly Gap[];
  claims: readonly Claim[];
  role?: string | null;
  brief?: Brief | null;
  language?: string;
}): CallBrief {
  const picked: CallQuestion[] = [];
  const seen = new Set<string>();
  const add = (q: CallQuestion): void => {
    if (picked.length >= MAX_CALL_QUESTIONS || seen.has(q.question_id)) return;
    if (containsArt9Topic(q.text)) return;
    seen.add(q.question_id);
    picked.push(q);
  };

  if (input.brief) {
    coverageQuestions(input.brief, input.questions).forEach(add);
    toVerifyQuestions(input.brief).forEach(add);
  }
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

  return composeCallBrief({ goal: input.goal, subject: input.subject, role: input.role ?? null, questions: picked, language: input.language });
}

/** A question as the operator sends it: proposed ones keep their id, new ones get `hr-<n>`. */
export type HrQuestion = { question_id?: string; text: string; why?: string };

export type HrBriefResult = { brief: CallBrief; error: null } | { brief: null; error: string; index: number | null };

const ID_PATTERN = /^[\w.:-]{1,64}$/;

/** The operator's edited questions as a CallBrief; any invalid question is an error with its index. */
export function briefFromHrQuestions(input: {
  goal: GoalId;
  subject: string;
  role: string | null;
  questions: readonly HrQuestion[];
  language?: string;
}): HrBriefResult {
  const fail = (error: string, index: number | null): HrBriefResult => ({ brief: null, error, index });
  if (input.questions.length === 0) return fail("add at least one question", null);
  if (input.questions.length > MAX_CALL_QUESTIONS) return fail(`at most ${String(MAX_CALL_QUESTIONS)} questions`, null);

  const used = new Set<string>();
  const drafts: { id: string | null; text: string; why: string }[] = [];
  for (const [i, q] of input.questions.entries()) {
    const text = oneLine(q.text, HR_QUESTION_MAX + 1);
    if (text.length < HR_QUESTION_MIN || text.length > HR_QUESTION_MAX) {
      return fail(`question ${String(i + 1)} must be ${String(HR_QUESTION_MIN)} to ${String(HR_QUESTION_MAX)} characters`, i);
    }
    if (containsArt9Topic(text)) return fail(`question ${String(i + 1)} touches a protected topic (health, politics, religion, ethnicity, sexuality)`, i);
    const id = q.question_id !== undefined && ID_PATTERN.test(q.question_id) && !used.has(q.question_id) ? q.question_id : null;
    if (id !== null) used.add(id);
    drafts.push({ id, text, why: q.why === undefined ? "" : oneLine(q.why, 120) });
  }

  // New questions get the first free hr-<n>, after every kept id is known.
  let n = 0;
  const nextId = (): string => {
    do n += 1;
    while (used.has(`hr-${String(n)}`));
    return `hr-${String(n)}`;
  };
  const questions: CallQuestion[] = drafts.map((d) => ({
    question_id: d.id ?? nextId(),
    text: d.text,
    expected: "",
    ...(d.why === "" ? {} : { why: d.why }),
  }));

  return { brief: composeCallBrief({ ...input, questions }), error: null };
}
