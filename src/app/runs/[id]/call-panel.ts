/**
 * Pure helpers and the API contract for the phone-verification panel on the brief page.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/call-panel.ts
 * Deps:    zod, src/domain/call, src/domain/call-brief (limits)
 * Tested:  src/app/runs/[id]/__tests__/call-panel.test.ts
 *
 * Key responsibilities:
 * - CallView / RunCalls: the GET /api/calls/:id and GET /api/runs/:id/calls contract (shared with the routes)
 * - finishAnswers: the per-question results stored in a `call:finish` ledger row's ref
 * - Phone number normalisation and validation, form validation, editable question drafts
 * - callPhase: call status + answers → what the panel shows and whether polling goes on
 * - formatAt, ANSWER_BADGE, usageLine: display texts
 *
 * Design constraints:
 * - Pure (no React, no fetch) so the routes and the client component can both import it
 * - Shows what the candidate said, never a verdict word or a score about the candidate
 */
import { z } from "zod";
import { type Call, CallAnswer, type CallAnswerStatus, type CallBrief, type CallProvider } from "@/domain/call";
import { HR_QUESTION_MAX, HR_QUESTION_MIN, MAX_CALL_QUESTIONS } from "@/domain/call-brief";

/** One call as the public routes return it: no consent note, operator, R2 key or transcript. */
export type CallView = Omit<Call, "consent_note" | "operator" | "result_r2_key" | "consent_ack"> & {
  /** Per-question results from the `call:finish` ledger row; null while the result is still being read. */
  answers: CallAnswer[] | null;
};

/** GET /api/runs/:id/calls. `proposal` is computed on every request and never stored. */
export type RunCalls = {
  provider: CallProvider;
  max: number;
  used: number;
  proposal: CallBrief;
  calls: CallView[];
};

const FinishRef = z.object({ answers: z.array(CallAnswer).optional() }).loose();

/** Answers from a `call:finish` ref_json; null without a row, [] for rows written before answers existed. */
export function finishAnswers(refJson: string | null): CallAnswer[] | null {
  if (refJson === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(refJson);
  } catch {
    return [];
  }
  const parsed = FinishRef.safeParse(raw);
  return parsed.success ? (parsed.data.answers ?? []) : [];
}

const E164 = /^\+[1-9]\d{6,14}$/;

/** "+420 777 123 456", "00420-777…" → "+420777123456"; spaces, dashes, dots and brackets dropped. */
export function normalizeNumber(raw: string): string {
  const compact = raw.replace(/[\s\-.()]/g, "");
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
}

export function validNumber(raw: string): boolean {
  return E164.test(normalizeNumber(raw));
}

/** A question in the editor; `key` is local (React list key), `question_id` only for proposed or saved ones. */
export type DraftQuestion = { key: string; question_id?: string; text: string; why?: string };

export function draftsFromProposal(brief: Pick<CallBrief, "questions">): DraftQuestion[] {
  return brief.questions.map((q) => ({ key: q.question_id, question_id: q.question_id, text: q.text, ...(q.why === undefined ? {} : { why: q.why }) }));
}

/** Body questions for POST /api/runs/:id/calls. */
export function toHrQuestions(drafts: readonly DraftQuestion[]): { question_id?: string; text: string; why?: string }[] {
  return drafts.map(({ key: _key, ...q }) => ({ ...q, text: q.text.trim() }));
}

export type CallForm = {
  number: string;
  consent: boolean;
  note: string;
  operator: string;
  questions: readonly DraftQuestion[];
};

/** Why "Call candidate now" is disabled; empty when the call may be placed. */
export function formProblems(form: CallForm, used: number, max: number): string[] {
  const problems: string[] = [];
  if (used >= max) problems.push(`This run already used all ${String(max)} calls.`);
  if (form.questions.length === 0) problems.push("Add at least one question.");
  if (form.questions.length > MAX_CALL_QUESTIONS) problems.push(`At most ${String(MAX_CALL_QUESTIONS)} questions.`);
  if (form.questions.some((q) => q.text.trim().length < HR_QUESTION_MIN || q.text.trim().length > HR_QUESTION_MAX)) {
    problems.push(`Each question needs ${String(HR_QUESTION_MIN)} to ${String(HR_QUESTION_MAX)} characters.`);
  }
  if (!validNumber(form.number)) problems.push("Enter the phone number in international format, e.g. +420 777 123 456.");
  if (!form.consent) problems.push("Confirm that the candidate agreed to the call and the recording.");
  if (form.note.trim() === "") problems.push("Note how the candidate agreed.");
  if (form.operator.trim() === "") problems.push("Enter your name.");
  return problems;
}

export type CallPhase =
  | { kind: "calling"; text: string }
  | { kind: "reading"; text: string }
  | { kind: "finished"; text: string }
  | { kind: "ended"; text: string };

/** What the panel says about a call; `ended` and `finished` stop the polling. */
export function callPhase(call: Pick<CallView, "status" | "answers" | "to_number_masked" | "failure_reason" | "last_error">): CallPhase {
  switch (call.status) {
    case "drafted":
      return { kind: "ended", text: "Not placed." };
    case "skipped":
      return { kind: "ended", text: "Skipped." };
    case "dialing":
      return { kind: "calling", text: `Calling ${call.to_number_masked ?? "the candidate"}…` };
    case "no_answer":
      return { kind: "ended", text: "No answer." };
    case "refused":
      return { kind: "ended", text: "The candidate declined the call." };
    case "failed":
      return { kind: "ended", text: `Call failed: ${call.failure_reason ?? call.last_error ?? "unknown reason"}` };
    case "done":
      if (call.answers !== null) return { kind: "finished", text: "Call finished." };
      if (call.last_error !== null) return { kind: "ended", text: `Call finished, but the answers could not be read: ${call.last_error}` };
      return { kind: "reading", text: "Call finished, reading the answers…" };
  }
}

export function isSettled(phase: CallPhase): boolean {
  return phase.kind === "finished" || phase.kind === "ended";
}

/** 83 → "1:23". */
export function formatAt(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, "0")}`;
}

export const ANSWER_BADGE: Readonly<Record<CallAnswerStatus, { label: string; cls: string }>> = {
  answered: { label: "Answered", cls: "bg-ok-bg text-ok" },
  unclear: { label: "Unclear", cls: "bg-unsure-bg text-unsure" },
  declined: { label: "Declined", cls: "bg-canvas text-muted" },
  no_answer: { label: "No answer", cls: "bg-canvas text-muted" },
  not_asked: { label: "Not asked", cls: "bg-canvas text-muted" },
};

export function usageLine(used: number, max: number): string {
  return `${String(used)} of ${String(max)} ${max === 1 ? "call" : "calls"} used for this run`;
}

/** Calls worth showing: placed ones (not drafted, not skipped), newest first as the route returns them. */
export function placedCalls(calls: readonly CallView[]): CallView[] {
  return calls.filter((c) => c.status !== "drafted" && c.status !== "skipped");
}
