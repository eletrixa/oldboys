/**
 * LLM-drafted verification call questions: specific, open questions from the confirmed research, with the rule-based
 * questions as the fallback.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/call-questions-llm.ts
 * Deps:    zod, src/domain/{art9,call,call-brief,report-translation} (types from claim.ts, ports.ts, recipe/step.ts)
 * Tested:  src/domain/__tests__/call-questions-llm.test.ts
 *
 * Key responsibilities:
 * - drafterInput: the only research the model sees: role, must-haves with coverage and summary, to_verify (CV differences
 *   first, as the brief writes them), contradicted or low-confidence claim texts, profile risks / history / position fit
 *   gaps / profile questions, and plain "no … found" gaps; never personality, also_found, evidence quotes, URLs, e-mails,
 *   tool or model errors, budget notes or bracketed pipeline annotations (a text carrying one is left out)
 * - draftPrompt + DraftOutput: one `primary`-model call; 3–5 spoken questions, each with why, listen_for, follow_up and
 *   the id it closes
 * - safeQuestions: deterministic safety after the model: one line, length caps, Art. 9 and off-limits topics dropped
 *   (a question whose text hits is dropped, a hit in why / listen_for / follow_up drops that field), no URLs or e-mails,
 *   dedupe by id and text, ids mapped to the input ids or `ai-<n>`, at most MAX_CALL_QUESTIONS
 * - draftCallQuestions: model call with timeout; on a throw, timeout, invalid output or nothing left after the filter the
 *   rule-based buildCallBrief questions are returned (`source: "rules"`) with the cost the failed call still reported
 * - draftInputHash / callQuestionsKey / CachedCallQuestions: the R2 cache of a draft (`call-questions/<runId>.json`)
 *
 * Design constraints:
 * - No I/O: the LLM is an injected port; the route does R2, D1 and the ledger row
 * - Only question drafting uses the model; the brief structure, agent prompt, first message and safety filters stay in
 *   call-brief.ts and stay deterministic
 * - The call verifies the research, never judges the candidate: nothing about personality, emotions, salary, other
 *   candidates or the hiring decision; hiring goal only (a due-diligence callee is a third person)
 * - Any change to SYSTEM or drafterInput bumps PROMPT_VERSION (it is part of the cache hash)
 */
import { z } from "zod";
import { containsArt9Topic } from "./art9";
import { CallQuestion } from "./call";
import { buildCallBrief, MAX_CALL_QUESTIONS } from "./call-brief";
import type { Brief, Claim, Gap, GoalId } from "./claim";
import type { LlmCall } from "./ports";
import { failedCallCost } from "./report-translation";
import type { Question } from "@/recipe/step";

export const CALL_QUESTIONS_STEP = "call:questions";
export const PROMPT_VERSION = "call-questions-v2";
export const DRAFT_TIMEOUT_MS = 60_000;
/** Output cap of the draft call: five questions with notes fit in ~1.5k tokens, the rest is room for thinking. */
export const DRAFT_MAX_OUTPUT_TOKENS = 6000;
/** Upper bound of one draft at Opus 5.5 list price (~6k tokens in, DRAFT_MAX_OUTPUT_TOKENS out); checked against the call budget. */
export const DRAFT_ESTIMATE_USD = 0.15;
export const TEXT_MAX = 240;
const WHY_MAX = 120;
const NOTE_MAX = 200;

export type DraftInputs = {
  goal: GoalId;
  subject: string;
  role: string | null;
  questions: readonly Question[];
  gaps: readonly Gap[];
  claims: readonly Claim[];
  brief: Brief | null;
};

/** What the model sees; built field by field so nothing new leaks in when Brief grows. */
export type DrafterInput = {
  role: string | null;
  must_haves: { id: string; must_have: string; coverage: string; found: string }[];
  to_verify: { id: string; text: string }[];
  weak_claims: string[];
  risks: string[];
  history: string[];
  fit_gaps: string[];
  profile_questions: { text: string; closes: string }[];
  nothing_found: { id: string; text: string }[];
};

const URL_OR_EMAIL = /https?:\/\/|www\.|[\w.%+-]+@[a-z\d.-]+\.[a-z]{2,}/i;
/** Topics a hiring call must not raise beyond Art. 9: pay, family, age, other candidates, the decision. */
const OFF_LIMITS =
  /\b(salary|salaries|wage|wages|pay rise|compensation|how old|your age|married|marriage|spouse|children|kids|family|pregnan\w*|other candidates?|hiring decision|personality|emotion\w*|feel about yourself)\b/i;

/** Tool or model notes ("summary model failed … 529 overloaded", budget, HTTP codes): internal, never research. */
const TOOL_NOTE = /(AI summary unavailable|summary model|model (failed|unavailable)|overloaded|request failed|not searched|run budget|budget (reached|exceeded)|HTTP \d{3}|timed out|fallback)/i;
/** Internal annotations the pipeline appends in brackets ("[names aliases of one organisation: A | B]"). */
const BRACKET_NOTE = /\s*\[[^\]]*\]/g;

function line(text: string, max: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/** A text safe to show the model: one line, capped, no bracket notes, URL, e-mail, tool note or Art. 9 topic. */
function clean(text: string, max: number): string | null {
  const t = line(text.replace(BRACKET_NOTE, ""), max);
  return t === "" || URL_OR_EMAIL.test(t) || TOOL_NOTE.test(t) || containsArt9Topic(t) ? null : t;
}

function plainNothingFound(reason: string): boolean {
  const r = reason.trim().toLowerCase();
  return r.startsWith("no ") && !r.includes("request failed") && !r.includes("not searched") && !r.includes("fallback") && !r.includes("budget");
}

function nonNull<T>(items: readonly (T | null)[]): T[] {
  return items.filter((i): i is T => i !== null);
}

function period(from: string | null, to: string | null): string {
  if (from === null && to === null) return "dates not given";
  return `${from ?? "?"} – ${to ?? "present"}`;
}

/** The research the drafter may use; personality, also_found, evidence quotes and tool notes never enter. */
export function drafterInput(inputs: DraftInputs): DrafterInput {
  const brief = inputs.brief;
  const byId = new Map(inputs.questions.map((q) => [q.id, q]));
  const must_haves = nonNull(
    (brief?.per_question ?? []).map((p) => {
      const q = byId.get(p.question_id);
      if (!p.question_id.startsWith("mh-") || q === undefined) return null;
      const name = clean(q.title ?? q.text, 200);
      if (name === null) return null;
      return { id: p.question_id, must_have: name, coverage: p.coverage, found: clean(p.summary, 400) ?? "" };
    }),
  );
  const to_verify = nonNull((brief?.to_verify ?? []).map((t, i) => {
    const text = clean(t, 300);
    return text === null ? null : { id: `tv-${String(i + 1)}`, text };
  }));
  const verifying = new Set(to_verify.map((t) => t.text));
  const weak_claims = [
    ...new Set(
      nonNull(
        inputs.claims
          .filter((c) => c.kind !== "STATEMENT" && (c.confidence < 0.6 || c.contradicts.length > 0))
          .map((c) => clean(c.text, 300)),
      ),
    ),
  ]
    .filter((t) => !verifying.has(t))
    .slice(0, 10);
  const profile = brief?.profile ?? null;
  const risks = nonNull((profile?.risks ?? []).map((r) => clean(r.detail === "" ? r.text : `${r.text}: ${r.detail}`, 300))).slice(0, 8);
  const history = nonNull(
    (profile?.history ?? []).map((h) => clean(`${h.kind}: ${h.title} at ${h.organization} (${period(h.from, h.to)})${h.summary === "" ? "" : `. ${h.summary}`}`, 300)),
  ).slice(0, 10);
  const fit_gaps = nonNull(
    (profile?.position_fit ?? []).flatMap((f) => f.traits.filter((t) => t.status !== "has").map((t) => clean(`${t.trait} (${t.status === "none" ? "no evidence" : "partial evidence"})`, 200))),
  ).slice(0, 10);
  const profile_questions = nonNull(
    (profile?.questions ?? []).map((q) => {
      const text = clean(q.text, 300);
      return text === null ? null : { text, closes: clean(q.closes, 200) ?? "" };
    }),
  ).slice(0, 8);
  const nothing_found = nonNull(
    inputs.gaps.map((g) => {
      if (byId.has(g.question_id)) {
        const q = byId.get(g.question_id);
        const text = q === undefined ? null : clean(q.title ?? q.text, 200);
        return text === null ? null : { id: g.question_id, text: `nothing found for: ${text}` };
      }
      if (!plainNothingFound(g.reason)) return null;
      const text = clean(g.reason, 200);
      return text === null ? null : { id: g.question_id, text };
    }),
  ).slice(0, 8);
  return {
    role: inputs.role === null ? null : clean(inputs.role, 120),
    must_haves,
    to_verify,
    weak_claims,
    risks,
    history,
    fit_gaps,
    profile_questions,
    nothing_found,
  };
}

/** Ids a drafted question may close: must-haves, to-verify items and gaps; anything else becomes ai-<n>. */
function knownIds(input: DrafterInput): Set<string> {
  return new Set([...input.must_haves.map((m) => m.id), ...input.to_verify.map((t) => t.id), ...input.nothing_found.map((g) => g.id)]);
}

const SYSTEM = `You draft the questions for a short phone call between an AI voice agent and a job candidate.
The call is a verification and fact-finding call: it checks what public research found or could not find, so the hiring team gets facts it could not confirm online. It never judges, scores or evaluates the person.

Write 3 to 5 questions, most valuable first. Value = closes a must-have without evidence, settles a contradiction or a "to verify" item, or fills a gap that matters for the role.

Each question:
- "text": what the agent says aloud. Spoken, second-person English, open, one question per turn, at most 200 characters. Be specific: anchor it on a concrete public fact from the research where one exists (an employer, a project, a repo, a title, a year), then ask for real examples, scope, their own contribution, numbers, tools or team size. Good: "Your GitHub has a repo with Airflow DAGs from 2023 - which part did you build yourself, and what was the hardest problem?" Bad: "Do you have Airflow experience?"
- Phrase contradictions neutrally, never accusingly: "Two of your public profiles give different dates for your role at X - which dates are right?"
- No yes/no-only questions, unless the question confirms a single date or title.
- "why": for the hiring team only, never read aloud: which must-have, gap or item it closes, at most 120 characters.
- "listen_for": what a useful answer contains (concrete example, own part, scale, tools, dates). It is not a score and never a judgement of the person. At most 200 characters.
- "follow_up": one short, targeted follow-up the agent may ask if the answer is vague, e.g. "Which tools exactly, and how big was the team?". At most 160 characters.
- "closes": the id of the must-have (mh-...), to-verify item (tv-...) or gap it closes, exactly as given; "" when none.

Never:
- health, family, religion, politics, ethnicity, sexuality, age, union membership or any other sensitive personal topic;
- salary, other candidates or the hiring decision;
- personality, emotions or how the person feels;
- research details beyond what the question itself needs; never a URL, an e-mail or a source name the candidate did not publish themselves;
- facts that are not in the research below; do not invent employers, projects, dates or numbers.

Answer with JSON only, in the given schema.`;

export const DraftOutput = z.object({
  questions: z.array(
    z.object({
      text: z.string(),
      why: z.string(),
      listen_for: z.string(),
      follow_up: z.string(),
      closes: z.string(),
    }),
  ),
});
export type DraftOutput = z.infer<typeof DraftOutput>;

export function draftPrompt(input: DrafterInput): { system: string; prompt: string } {
  return {
    system: SYSTEM,
    prompt: `Research about the candidate (confirmed identity only):\n${JSON.stringify(input, null, 1)}\n\nDraft the call questions.`,
  };
}

/** One optional note field after the safety rules; undefined when empty, too long or off limits. */
function note(text: string, max: number): string | undefined {
  const t = line(text, max + 1);
  if (t === "" || t.length > max || URL_OR_EMAIL.test(t) || containsArt9Topic(t) || OFF_LIMITS.test(t)) return undefined;
  return t;
}

function textKey(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** The model's questions after the deterministic safety rules, in model order, at most MAX_CALL_QUESTIONS. */
export function safeQuestions(output: DraftOutput, ids: ReadonlySet<string>): CallQuestion[] {
  const picked: CallQuestion[] = [];
  const usedIds = new Set<string>();
  const usedTexts = new Set<string>();
  let n = 0;
  for (const q of output.questions) {
    if (picked.length >= MAX_CALL_QUESTIONS) break;
    const text = line(q.text, TEXT_MAX + 1);
    // A cut question would be read out half-finished: too long is dropped, never truncated.
    if (text.length < 5 || text.length > TEXT_MAX) continue;
    if (URL_OR_EMAIL.test(text) || containsArt9Topic(text) || OFF_LIMITS.test(text)) continue;
    const key = textKey(text);
    if (usedTexts.has(key)) continue;
    usedTexts.add(key);
    const closes = q.closes.trim();
    let id: string;
    if (ids.has(closes) && !usedIds.has(closes)) {
      id = closes;
    } else {
      do n += 1;
      while (usedIds.has(`ai-${String(n)}`));
      id = `ai-${String(n)}`;
    }
    usedIds.add(id);
    const why = note(q.why, WHY_MAX);
    const listen_for = note(q.listen_for, NOTE_MAX);
    const follow_up = note(q.follow_up, NOTE_MAX);
    picked.push({
      question_id: id,
      text,
      expected: "",
      ...(why === undefined ? {} : { why }),
      ...(listen_for === undefined ? {} : { listen_for }),
      ...(follow_up === undefined ? {} : { follow_up }),
    });
  }
  return picked;
}

export type DraftResult = {
  /** "ai" = drafted by the model; "rules" = the deterministic buildCallBrief questions. */
  source: "ai" | "rules";
  questions: CallQuestion[];
  cost_usd: number;
  /** Why the rules were used; null for an AI draft. */
  reason: string | null;
  /** Model calls made (0 when the model was not asked). */
  calls: number;
};

/** The rule-based questions for the same inputs: today's proposal and the fallback. */
export function ruleQuestions(inputs: DraftInputs): CallQuestion[] {
  return buildCallBrief(inputs).questions;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`timed out after ${String(ms)} ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/** Model-drafted questions, or the rule-based ones when the model is unavailable, fails or leaves nothing usable. */
export async function draftCallQuestions(llm: LlmCall | null, inputs: DraftInputs, timeoutMs = DRAFT_TIMEOUT_MS): Promise<DraftResult> {
  const rules = (reason: string, cost_usd = 0, calls = 0): DraftResult => ({ source: "rules", questions: ruleQuestions(inputs), cost_usd, reason, calls });
  if (inputs.goal !== "hiring") return rules("AI drafting is for hiring calls only");
  if (inputs.brief === null) return rules("the brief is not finished");
  if (llm === null) return rules("no AI key configured");
  const input = drafterInput(inputs);
  try {
    const result = await withTimeout(llm({ model: "primary", ...draftPrompt(input), schema: DraftOutput, maxOutputTokens: DRAFT_MAX_OUTPUT_TOKENS }), timeoutMs);
    const questions = safeQuestions(result.value, knownIds(input));
    if (questions.length === 0) return rules("the AI draft had no usable question", result.cost_usd, 1);
    return { source: "ai", questions, cost_usd: result.cost_usd, reason: null, calls: 1 };
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    return rules(`the AI draft failed (${e.name})`, failedCallCost(error), 1);
  }
}

/** SHA-256 over PROMPT_VERSION and the drafter input: a changed brief or prompt drafts again. */
export async function draftInputHash(inputs: DraftInputs): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([PROMPT_VERSION, inputs.goal, inputs.subject, drafterInput(inputs)]));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function callQuestionsKey(runId: string): string {
  return `call-questions/${runId}.json`;
}

/** The R2 cache object of an AI draft: the input hash it was drafted from and the safe questions. */
export const CachedCallQuestions = z.object({
  input_hash: z.string().min(1),
  questions: z.array(CallQuestion).min(1).max(MAX_CALL_QUESTIONS),
});
export type CachedCallQuestions = z.infer<typeof CachedCallQuestions>;
