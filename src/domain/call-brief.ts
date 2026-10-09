/**
 * CallBrief builder: turns the brief, recipe questions, gaps and weak claims (or drafted questions) into a call script.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/call-brief.ts
 * Deps:    src/domain/art9, src/domain/scrub, src/domain/call-wording (types from call.ts, claim.ts and recipe/step.ts)
 * Tested:  src/domain/__tests__/call-brief.test.ts
 *
 * Key responsibilities:
 * - Pick at most MAX_CALL_QUESTIONS questions: role must-haves without evidence, then with partial evidence,
 *   then the brief's "to verify" items, then gaps, then low-confidence or contradicted claims
 * - A gap keyed by a recipe question asks that question; a gap keyed by a source step asks about its reason only
 *   when it is a plain "no … found" statement (scrubbed); tool failures, budget, fallback and namesake gaps are skipped
 * - Proposed questions are spoken second-person English (call-wording.ts): "Do you have …?", "Can you tell me
 *   about your <title>?", "We read that you … Is that right?"; the `why` chip tells HR what evidence is missing
 * - composeCallBrief: the script (display), the agent's short first message (AI disclosure, who for and why,
 *   recording, consent question; at most FIRST_MESSAGE_MAX characters) and the agent system prompt (steps with the
 *   skip/stop sentence right after consent, questions in order, rules)
 * - Each question may carry `follow_up` and `listen_for` (LLM-drafted, call-questions-llm.ts); the agent prompt lists
 *   them under the question as "If the answer is vague, ask: …" and "Listen for (do not read aloud): …"
 * - briefFromHrQuestions: the operator's edited questions, validated (1–5, 5–300 chars, no Art. 9 topic in the text,
 *   follow-up or listen-for)
 * - Drop anything that touches a GDPR Art. 9 topic before it can be asked
 *
 * Design constraints:
 * - Pure and deterministic: no I/O, no LLM, same input gives the same output; the LLM drafter
 *   (call-questions-llm.ts) only proposes question texts, this module still composes and filters everything
 * - Never read internal tool output (URLs, e-mails, HTTP codes, budget notes) to the candidate
 * - Never ask about Art. 9 data (shared denylist in art9.ts); an operator question that touches one is an
 *   error with its index, never a silent drop
 * - Without a brief the selection is gaps then weak claims, exactly as before the brief existed
 */
import { containsArt9Topic } from "@/domain/art9";
import type { CallBrief, CallQuestion } from "@/domain/call";
import { mustHaveQuestion, subjectRefs, toVerifyQuestion } from "@/domain/call-wording";
import type { Brief, Claim, Gap, GoalId } from "@/domain/claim";
import { scrubReason } from "@/domain/scrub";
import type { Question } from "@/recipe/step";

export const MAX_CALL_QUESTIONS = 5;
export const HR_QUESTION_MIN = 5;
export const HR_QUESTION_MAX = 300;
/** Callees talk over a long opener: the first message stays one breath (about 9 seconds of speech). */
export const FIRST_MESSAGE_MAX = 220;
/** Names spoken in the first message are cut to this many characters so the opener stays under FIRST_MESSAGE_MAX. */
const SPOKEN_NAME_MAX = 60;

const PURPOSE: Record<GoalId, string> = {
  hiring: "I would like to confirm a few facts for a hiring check.",
  "due-diligence": "I would like to confirm a few public facts for a due-diligence check.",
};

const CONSENT_CLOSE = "This call is recorded. Do you have three minutes for a few questions?";
const SKIP_STOP = "You can skip any question or stop at any time.";

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

/** A name as spoken in the opener: the role's title part ("Senior Data Engineer, Prague" -> "Senior Data Engineer"), cut at a word. */
function spoken(name: string): string {
  const head = (name.split(",")[0] ?? name).trim() || name;
  if (head.length <= SPOKEN_NAME_MAX) return head;
  const cut = head.slice(0, SPOKEN_NAME_MAX);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).trim();
}

function firstMessage(goal: GoalId, subject: string, role: string | null): string {
  if (goal === "due-diligence") {
    return `Hi, this is an AI assistant calling for a researcher to confirm a few public facts about ${spoken(subject).replace(/\.+$/, "")}. ${CONSENT_CLOSE}`;
  }
  const about = role === null ? "a role you applied for" : `the ${spoken(role)} role`;
  return `Hi, this is an AI assistant calling for the hiring team about ${about}. ${CONSENT_CLOSE}`;
}

/** A question in the agent prompt: its text first, then its own follow-up and listen-for notes when it has them. */
function questionLines(q: CallQuestion, i: number): string[] {
  return [
    `${String(i + 1)}. ${q.text}`,
    ...(q.follow_up === undefined ? [] : [`   If the answer is vague, ask: "${q.follow_up}"`]),
    ...(q.listen_for === undefined ? [] : [`   Listen for (do not read aloud): ${q.listen_for}`]),
  ];
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
    "Your first message already said that you are an AI, who you call for and why, that the call is recorded, and asked for consent (whether they have three minutes).",
    "",
    "# Steps",
    "1. Wait for the answer to your first message. If the callee does not agree, or says it is a bad time, thank them, say goodbye and use the end_call tool.",
    `   If they agree, say in one short sentence: "${SKIP_STOP}" Then go on with step 2.`,
    `2. Ask: "${identity}" If the answer is no, apologise, share nothing about the research, say goodbye and use the end_call tool.`,
    "3. Ask the questions below one at a time, in this order, and wait for each answer. Ask at most one short follow-up per question when the answer is unclear; when the question has its own follow-up, use that one. If the callee does not want to answer, say \"No problem\" and move to the next question.",
    `4. After the last question, thank them, say that ${reviewer} will review the answers, say goodbye and use the end_call tool.`,
    "",
    "# Questions",
    ...(questions.length === 0 ? ["(none: thank them and end the call after the identity question)"] : questions.flatMap(questionLines)),
    "",
    "# Rules",
    "- Never evaluate, judge or comment on the answers; just thank them and move on.",
    "- Say nothing about the hiring decision, salary or other candidates.",
    "- Never ask about personal topics: health, family, religion, politics, ethnicity, sexuality, age or union membership. If the callee raises one, do not follow up.",
    "- Do not invent or reveal what the research found beyond the question text.",
    "- The \"Listen for\" notes are for you only: never read them aloud and never use them to judge the answer; they only tell you whether the one follow-up is needed.",
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
function coverageQuestions(brief: Brief, questions: readonly Question[], refs: readonly string[]): CallQuestion[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const pick = (coverage: "none" | "partial"): CallQuestion[] =>
    brief.per_question.flatMap((p) => {
      const q = byId.get(p.question_id);
      if (!p.question_id.startsWith("mh-") || p.coverage !== coverage || q === undefined) return [];
      const title = q.title === undefined ? undefined : oneLine(q.title, 200);
      const name = oneLine(q.title ?? q.text, 200).replace(/[.?!]+$/, "");
      const text = mustHaveQuestion({ title, text: oneLine(q.text, 250), coverage, refs });
      const why = coverage === "none" ? `No public evidence: ${name}` : `Partial evidence: ${name}`;
      return [{ question_id: p.question_id, text, expected: "", why }];
    });
  return [...pick("none"), ...pick("partial")];
}

/** A source-step gap reason worth asking about: a plain recipe "no … found" statement, never tool output or a note. */
function plainNothingFound(reason: string): boolean {
  const r = reason.trim().toLowerCase();
  return r.startsWith("no ") && !r.includes("request failed") && !r.includes("not searched") && !r.includes("fallback");
}

function toVerifyQuestions(brief: Brief, refs: readonly string[]): CallQuestion[] {
  return brief.to_verify.map((text, i) => {
    const point = oneLine(text, 250).replace(/[.?!]+$/, "");
    return { question_id: `tv-${String(i + 1)}`, text: toVerifyQuestion(point, refs), expected: point, why: "To verify" };
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
    // Only a hiring call speaks to the subject; a due-diligence callee is someone else, so names stay names.
    const refs = input.goal === "hiring" ? subjectRefs(input.subject) : [];
    coverageQuestions(input.brief, input.questions, refs).forEach(add);
    toVerifyQuestions(input.brief, refs).forEach(add);
  }
  const byId = new Map(input.questions.map((q) => [q.id, q]));
  for (const gap of input.gaps) {
    const q = byId.get(gap.question_id);
    if (q) {
      add({ question_id: gap.question_id, text: q.text, expected: "" });
      continue;
    }
    // The runner keys collector gaps by step id (e.g. github_profile). Only a plain "nothing found" reason is a
    // topic for the candidate; failures, budget, fallback and namesake notes are internal and never read out.
    if (!plainNothingFound(gap.reason)) continue;
    const text = `Our public research found nothing here: ${scrubReason(gap.reason)}. Can you confirm that, or tell me what we missed?`;
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
export type HrQuestion = { question_id?: string; text: string; why?: string; listen_for?: string; follow_up?: string };

/** Cap of an operator's follow-up and listen-for note. */
export const HR_NOTE_MAX = 200;

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
  const drafts: { id: string | null; text: string; why: string; listen_for: string; follow_up: string }[] = [];
  for (const [i, q] of input.questions.entries()) {
    const text = oneLine(q.text, HR_QUESTION_MAX + 1);
    if (text.length < HR_QUESTION_MIN || text.length > HR_QUESTION_MAX) {
      return fail(`question ${String(i + 1)} must be ${String(HR_QUESTION_MIN)} to ${String(HR_QUESTION_MAX)} characters`, i);
    }
    if (containsArt9Topic(text)) return fail(`question ${String(i + 1)} touches a protected topic (health, politics, religion, ethnicity, sexuality)`, i);
    const listen_for = q.listen_for === undefined ? "" : oneLine(q.listen_for, HR_NOTE_MAX);
    const follow_up = q.follow_up === undefined ? "" : oneLine(q.follow_up, HR_NOTE_MAX);
    if (containsArt9Topic(follow_up)) return fail(`the follow-up of question ${String(i + 1)} touches a protected topic (health, politics, religion, ethnicity, sexuality)`, i);
    if (containsArt9Topic(listen_for)) return fail(`the listen-for note of question ${String(i + 1)} touches a protected topic (health, politics, religion, ethnicity, sexuality)`, i);
    const id = q.question_id !== undefined && ID_PATTERN.test(q.question_id) && !used.has(q.question_id) ? q.question_id : null;
    if (id !== null) used.add(id);
    drafts.push({ id, text, why: q.why === undefined ? "" : oneLine(q.why, 120), listen_for, follow_up });
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
    ...(d.listen_for === "" ? {} : { listen_for: d.listen_for }),
    ...(d.follow_up === "" ? {} : { follow_up: d.follow_up }),
  }));

  return { brief: composeCallBrief({ ...input, questions }), error: null };
}
