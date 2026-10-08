/**
 * Phone verification setup: editable proposed questions, the agent's first message, number and consent form.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/call-setup.tsx
 * Deps:    react, src/domain/call (types), src/domain/call-brief (limit), ./call-panel
 * Tested:  n/a (validation in __tests__/call-panel.test.ts)
 *
 * Key responsibilities:
 * - Questions: edit, remove, add (up to MAX_CALL_QUESTIONS), reset to the proposal; `why` shown as a chip
 * - Form: phone number (E.164 after normalisation), consent checkbox, consent note, operator name
 *   (remembered in sessionStorage); "Call candidate now" only when formProblems is empty
 *
 * Design constraints:
 * - Client only and mounted after the proposal loaded, so sessionStorage is read without a hydration mismatch
 * - The number is only passed up to the approve request, never stored here beyond the input
 */
"use client";

import { useRef, useState } from "react";
import type { CallBrief } from "@/domain/call";
import { MAX_CALL_QUESTIONS } from "@/domain/call-brief";
import { type CallForm, type DraftQuestion, draftsFromProposal, formProblems, normalizeNumber } from "./call-panel";

const OPERATOR_KEY = "oldboys.operator";
const INPUT = "w-full rounded-xl border border-divider bg-surface px-3 py-2 text-sm text-ink focus:border-action focus:outline-none";
const SMALL_BTN = "rounded-xl border border-divider px-3 py-1.5 text-sm text-ink hover:bg-canvas";

function readOperator(): string {
  try {
    return sessionStorage.getItem(OPERATOR_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeOperator(name: string): void {
  try {
    sessionStorage.setItem(OPERATOR_KEY, name);
  } catch {
    // Storage blocked: the name is asked again next time.
  }
}

function QuestionEditor({
  drafts,
  errorIndex,
  onChange,
}: {
  drafts: readonly DraftQuestion[];
  errorIndex: number | null;
  onChange: (next: DraftQuestion[]) => void;
}): React.JSX.Element {
  const update = (i: number, text: string): void => {
    onChange(drafts.map((d, j) => (j === i ? { ...d, text } : d)));
  };
  return (
    <ol className="flex flex-col gap-3">
      {drafts.map((d, i) => (
        <li key={d.key} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">Question {String(i + 1)}</span>
            <div className="flex items-center gap-2">
              {d.why !== undefined && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">{d.why}</span>}
              <button
                type="button"
                className="rounded-full px-2 text-muted hover:bg-canvas hover:text-ink"
                aria-label={`Remove question ${String(i + 1)}`}
                onClick={() => {
                  onChange(drafts.filter((_, j) => j !== i));
                }}
              >
                ×
              </button>
            </div>
          </div>
          <textarea
            aria-label={`Question ${String(i + 1)}`}
            aria-invalid={errorIndex === i}
            rows={2}
            maxLength={300}
            value={d.text}
            onChange={(e) => {
              update(i, e.target.value);
            }}
            className={`${INPUT} ${errorIndex === i ? "border-conflict" : ""}`}
          />
        </li>
      ))}
    </ol>
  );
}

export function CallSetup({
  proposal,
  used,
  max,
  busy,
  errorIndex,
  onPlace,
}: {
  proposal: CallBrief;
  used: number;
  max: number;
  busy: boolean;
  errorIndex: number | null;
  onPlace: (form: CallForm) => void;
}): React.JSX.Element {
  const [drafts, setDrafts] = useState<DraftQuestion[] | null>(null);
  const [number, setNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState("");
  const [operator, setOperator] = useState(readOperator);
  const added = useRef(0);

  const questions = drafts ?? draftsFromProposal(proposal);
  const form: CallForm = { number: normalizeNumber(number), consent, note, operator, questions };
  const problems = formProblems(form, used, max);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (problems.length > 0 || busy) return;
        writeOperator(operator.trim());
        onPlace({ ...form, note: note.trim(), operator: operator.trim() });
      }}
    >
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-ink">Questions the agent will ask</h3>
        {questions.length === 0 ? <p className="text-sm text-muted">No questions. Add one below.</p> : <QuestionEditor drafts={questions} errorIndex={errorIndex} onChange={setDrafts} />}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SMALL_BTN}
            disabled={questions.length >= MAX_CALL_QUESTIONS}
            onClick={() => {
              added.current += 1;
              setDrafts([...questions, { key: `new-${String(added.current)}`, text: "" }]);
            }}
          >
            Add question
          </button>
          {drafts !== null && (
            <button
              type="button"
              className={SMALL_BTN}
              onClick={() => {
                setDrafts(null);
              }}
            >
              Reset to proposal
            </button>
          )}
        </div>
      </div>

      {proposal.first_message !== undefined && (
        <details className="rounded-xl bg-canvas px-3 py-2">
          <summary className="text-sm text-muted hover:text-ink">What the agent says first</summary>
          <p className="mt-2 text-sm text-ink">{proposal.first_message}</p>
        </details>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Candidate&apos;s phone number
          <input type="tel" autoComplete="off" placeholder="+420 777 123 456" value={number} onChange={(e) => { setNumber(e.target.value); }} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Your name
          <input type="text" autoComplete="name" maxLength={100} value={operator} onChange={(e) => { setOperator(e.target.value); }} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink sm:col-span-2">
          How the candidate agreed
          <input type="text" maxLength={500} placeholder="agreed by email on 8 Oct" value={note} onChange={(e) => { setNote(e.target.value); }} className={INPUT} />
        </label>
        <label className="flex items-start gap-2 text-sm text-ink sm:col-span-2">
          <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); }} className="mt-1" />
          The candidate agreed to this call and to the recording.
        </label>
      </div>

      {problems.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-muted">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <button
        type="submit"
        disabled={problems.length > 0 || busy}
        className="self-start rounded-xl bg-action px-4 py-2 font-medium text-white hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Placing the call…" : "Call candidate now"}
      </button>
    </form>
  );
}
