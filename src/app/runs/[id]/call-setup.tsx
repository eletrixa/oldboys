/**
 * Phone verification setup: editable proposed questions, the agent's first message, number and consent form.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/call-setup.tsx
 * Deps:    react, src/domain/call (types), src/domain/call-brief (limit), src/app/ui (Radar vocabulary), ./call-panel, ./report-lang (useReport)
 * Tested:  n/a (validation in __tests__/call-panel.test.ts)
 *
 * Key responsibilities:
 * - Questions: edit, remove, add (up to MAX_CALL_QUESTIONS), reset to the proposal; `why` shown as a chip;
 *   an AI draft is labelled "AI-drafted, edit before the call" and shows each question's follow-up and listen-for
 *   notes read-only (they stay when the text is edited); while it is drafted a short loading line replaces the list,
 *   a fallback shows the rule-based questions with a small note (a note from the route stays English)
 * - Form: phone number (E.164 after normalisation), consent checkbox, consent note, operator name
 *   (remembered in sessionStorage); "Call candidate now" only when formProblems is empty
 * - Labels, hints and validation follow the report language (`report.t.call`); the question texts, the `why` sent with
 *   them and the agent's first message stay English (the call is in English) and keep lang="en" on a Czech page
 *
 * Design constraints:
 * - Client only and mounted after the proposal loaded, so sessionStorage is read without a hydration mismatch
 * - The number is only passed up to the approve request, never stored here beyond the input
 */
"use client";

import { useRef, useState } from "react";
import type { CallBrief } from "@/domain/call";
import { MAX_CALL_QUESTIONS } from "@/domain/call-brief";
import { BTN_PRIMARY } from "@/app/ui";
import { type AiDraft, type CallForm, type DraftQuestion, draftsFromProposal, formProblems, normalizeNumber } from "./call-panel";
import { useReport } from "./report-lang";

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
  const report = useReport();
  const t = report.t.call;
  const english = report.lang === "en" ? undefined : "en";
  const update = (i: number, text: string): void => {
    onChange(drafts.map((d, j) => (j === i ? { ...d, text } : d)));
  };
  return (
    <ol className="flex flex-col gap-3">
      {drafts.map((d, i) => (
        <li key={d.key} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">{t.question(i + 1)}</span>
            <div className="flex items-center gap-2">
              {d.why !== undefined && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">{t.why(d.why)}</span>}
              <button
                type="button"
                className="rounded-full px-2 text-muted hover:bg-canvas hover:text-ink"
                aria-label={t.removeQuestion(i + 1)}
                onClick={() => {
                  onChange(drafts.filter((_, j) => j !== i));
                }}
              >
                ×
              </button>
            </div>
          </div>
          <textarea
            aria-label={t.question(i + 1)}
            lang={english}
            aria-invalid={errorIndex === i}
            rows={2}
            maxLength={300}
            value={d.text}
            onChange={(e) => {
              update(i, e.target.value);
            }}
            className={`${INPUT} ${errorIndex === i ? "border-conflict" : ""}`}
          />
          {d.follow_up !== undefined && <p className="text-xs text-muted">{t.followUp}<span lang={english}>{d.follow_up}</span></p>}
          {d.listen_for !== undefined && <p className="text-xs text-muted">{t.listenFor}<span lang={english}>{d.listen_for}</span></p>}
        </li>
      ))}
    </ol>
  );
}

export function CallSetup({
  proposal,
  draft,
  used,
  max,
  busy,
  errorIndex,
  onPlace,
}: {
  proposal: CallBrief;
  draft: AiDraft;
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
  const report = useReport();
  const t = report.t.call;
  const english = report.lang === "en" ? undefined : "en";

  const questions = drafts ?? draftsFromProposal(proposal);
  const form: CallForm = { number: normalizeNumber(number), consent, note, operator, questions };
  const problems = formProblems(form, used, max, t.problem);
  const drafting = draft.kind === "drafting";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (problems.length > 0 || busy || drafting) return;
        writeOperator(operator.trim());
        onPlace({ ...form, note: note.trim(), operator: operator.trim() });
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">{t.questionsHeading}</h3>
          {draft.kind === "ai" && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">{t.aiDrafted}</span>}
        </div>
        {t.englishNote !== "" && <p className="text-xs text-muted">{t.englishNote}</p>}
        {draft.kind === "rules" && (draft.note === null ? <p className="text-xs text-muted">{t.rulesFallback}</p> : <p className="text-xs text-muted" lang={english}>{draft.note}</p>)}
        {drafting ? (
          <p className="text-sm text-muted" aria-live="polite">{t.drafting}</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted">{t.noQuestions}</p>
        ) : (
          <QuestionEditor drafts={questions} errorIndex={errorIndex} onChange={setDrafts} />
        )}
        {!drafting && <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SMALL_BTN}
            disabled={questions.length >= MAX_CALL_QUESTIONS}
            onClick={() => {
              added.current += 1;
              setDrafts([...questions, { key: `new-${String(added.current)}`, text: "" }]);
            }}
          >
            {t.addQuestion}
          </button>
          {drafts !== null && (
            <button
              type="button"
              className={SMALL_BTN}
              onClick={() => {
                setDrafts(null);
              }}
            >
              {t.resetToProposal}
            </button>
          )}
        </div>}
      </div>

      {proposal.first_message !== undefined && (
        <details className="rounded-xl bg-canvas px-3 py-2">
          <summary className="text-sm text-muted hover:text-ink">{t.firstMessage}</summary>
          <p className="mt-2 text-sm text-ink" lang={english}>{proposal.first_message}</p>
        </details>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {t.numberLabel}
          <input type="tel" autoComplete="off" placeholder="+420 777 123 456" value={number} onChange={(e) => { setNumber(e.target.value); }} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {t.nameLabel}
          <input type="text" autoComplete="name" maxLength={100} value={operator} onChange={(e) => { setOperator(e.target.value); }} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink sm:col-span-2">
          {t.agreedLabel}
          <input type="text" maxLength={500} placeholder={t.agreedPlaceholder} value={note} onChange={(e) => { setNote(e.target.value); }} className={INPUT} />
        </label>
        <label className="flex items-start gap-2 text-sm text-ink sm:col-span-2">
          <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); }} className="mt-1" />
          {t.consent}
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
        disabled={problems.length > 0 || busy || drafting}
        className={`${BTN_PRIMARY} self-start`}
      >
        {busy ? t.placing : t.callNow}
      </button>
    </form>
  );
}
