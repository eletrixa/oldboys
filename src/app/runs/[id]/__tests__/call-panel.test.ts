/**
 * Tests for the phone verification panel helpers: number, form, drafts, call phase, display texts.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/call-panel.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - finishAnswers: null without a row, [] for old rows or junk, parsed answers otherwise
 * - normalizeNumber / validNumber; formProblems lists every reason the call button is disabled
 * - draftsFromProposal / toHrQuestions round trip (follow-up and listen-for kept through an edit); callPhase per status; formatAt; usageLine; placedCalls
 *
 * Design constraints:
 * - Pure: no React, no fetch
 */
import { describe, expect, it } from "vitest";
import type { CallAnswer } from "@/domain/call";
import {
  ANSWER_BADGE,
  type CallForm,
  type CallView,
  callPhase,
  draftsFromProposal,
  finishAnswers,
  formatAt,
  formProblems,
  isSettled,
  normalizeNumber,
  placedCalls,
  toHrQuestions,
  usageLine,
  validNumber,
} from "../call-panel";

const answer: CallAnswer = {
  question_id: "mh-1",
  question: "Tell me about Go?",
  status: "answered",
  summary: "Uses Go daily.",
  quote: "I used it every day",
  at_secs: 83,
};

const okForm: CallForm = {
  number: "+420777123456",
  consent: true,
  note: "agreed by email on 8 Oct",
  operator: "Minas",
  questions: [{ key: "mh-1", question_id: "mh-1", text: "Tell me about Go?" }],
};

const view = (over: Partial<CallView>): Pick<CallView, "status" | "answers" | "to_number_masked" | "failure_reason" | "last_error"> => ({
  status: "dialing",
  answers: null,
  to_number_masked: "+420*****456",
  failure_reason: null,
  last_error: null,
  ...over,
});

describe("finishAnswers", () => {
  it("is null without a finish row", () => {
    expect(finishAnswers(null)).toBeNull();
  });
  it("reads the answers of a finish ref", () => {
    expect(finishAnswers(JSON.stringify({ type: "phone", callId: "c", answers: [answer] }))).toEqual([answer]);
  });
  it("is empty for rows written before answers existed, and for junk", () => {
    expect(finishAnswers(JSON.stringify({ type: "phone", callId: "c", claims: 1 }))).toEqual([]);
    expect(finishAnswers("{not json")).toEqual([]);
    expect(finishAnswers(JSON.stringify({ answers: [{ status: "great" }] }))).toEqual([]);
  });
});

describe("phone number", () => {
  it("strips spaces, dashes, dots and brackets and turns 00 into +", () => {
    expect(normalizeNumber(" +420 777-123.456 ")).toBe("+420777123456");
    expect(normalizeNumber("00420 (777) 123 456")).toBe("+420777123456");
  });
  it("accepts E.164 only", () => {
    expect(validNumber("+420 777 123 456")).toBe(true);
    expect(validNumber("777 123 456")).toBe(false);
    expect(validNumber("+0123456789")).toBe(false);
    expect(validNumber("+42")).toBe(false);
  });
});

describe("formProblems", () => {
  it("is empty for a complete form under the limit", () => {
    expect(formProblems(okForm, 0, 2)).toEqual([]);
  });
  it("lists every missing piece", () => {
    const problems = formProblems({ number: "123", consent: false, note: " ", operator: "", questions: [] }, 0, 2);
    expect(problems).toHaveLength(5);
  });
  it("blocks when the run used all calls", () => {
    expect(formProblems(okForm, 2, 2)).toEqual(["This run already used all 2 calls."]);
  });
  it("blocks too short and too many questions", () => {
    expect(formProblems({ ...okForm, questions: [{ key: "a", text: "Go?" }] }, 0, 2)).toHaveLength(1);
    const six = Array.from({ length: 6 }, (_, i) => ({ key: String(i), text: "A fine question?" }));
    expect(formProblems({ ...okForm, questions: six }, 0, 2)).toEqual(["At most 5 questions."]);
  });
});

describe("drafts", () => {
  it("keeps ids and why from the proposal and trims the text for the request", () => {
    const drafts = draftsFromProposal({ questions: [{ question_id: "mh-1", text: "Go? ", expected: "", why: "No public evidence: Go" }] });
    expect(drafts).toEqual([{ key: "mh-1", question_id: "mh-1", text: "Go? ", why: "No public evidence: Go" }]);
    expect(toHrQuestions([...drafts, { key: "new-1", text: " New one? " }])).toEqual([
      { question_id: "mh-1", text: "Go?", why: "No public evidence: Go" },
      { text: "New one?" },
    ]);
  });

  it("keeps an AI draft's follow-up and listen-for through an edit of the text", () => {
    const [draft] = draftsFromProposal({
      questions: [{ question_id: "ai-1", text: "Which part of the DAGs is yours?", expected: "", follow_up: "Which operators?", listen_for: "Own part, scale." }],
    });
    if (draft === undefined) throw new Error("no draft");
    const edited = { ...draft, text: " Which part of the Airflow DAGs did you build? " };
    expect(toHrQuestions([edited])).toEqual([
      { question_id: "ai-1", text: "Which part of the Airflow DAGs did you build?", follow_up: "Which operators?", listen_for: "Own part, scale." },
    ]);
  });
});

describe("callPhase", () => {
  it("is calling with the masked number while dialing", () => {
    const p = callPhase(view({}));
    expect(p).toEqual({ kind: "calling", text: "Calling +420*****456…" });
    expect(isSettled(p)).toBe(false);
  });
  it("is reading while done without answers, finished with them", () => {
    expect(callPhase(view({ status: "done" }))).toEqual({ kind: "reading", text: "Call finished, reading the answers…" });
    const finished = callPhase(view({ status: "done", answers: [answer] }));
    expect(finished.kind).toBe("finished");
    expect(isSettled(finished)).toBe(true);
  });
  it("ends when the answers could not be read", () => {
    expect(callPhase(view({ status: "done", last_error: "llm down" })).kind).toBe("ended");
  });
  it("says why a call ended", () => {
    expect(callPhase(view({ status: "no_answer" })).text).toBe("No answer.");
    expect(callPhase(view({ status: "refused" })).text).toBe("The candidate declined the call.");
    expect(callPhase(view({ status: "failed", failure_reason: "busy" })).text).toBe("Call failed: busy");
    expect(callPhase(view({ status: "failed", last_error: "boom" })).text).toBe("Call failed: boom");
  });
});

describe("display texts", () => {
  it("formats the time in the call as m:ss", () => {
    expect(formatAt(0)).toBe("0:00");
    expect(formatAt(83)).toBe("1:23");
    expect(formatAt(600.4)).toBe("10:00");
  });
  it("labels every answer status without a verdict word", () => {
    expect(Object.values(ANSWER_BADGE).map((b) => b.label)).toEqual(["Answered", "Unclear", "Declined", "No answer", "Not asked"]);
  });
  it("counts the calls used", () => {
    expect(usageLine(1, 2)).toBe("1 of 2 calls used for this run");
    expect(usageLine(0, 1)).toBe("0 of 1 call used for this run");
  });
  it("shows only placed calls", () => {
    const calls = (["drafted", "done", "skipped", "failed"] as const).map((status, i) => ({ id: String(i), status }) as CallView);
    expect(placedCalls(calls).map((c) => c.status)).toEqual(["done", "failed"]);
  });
});
