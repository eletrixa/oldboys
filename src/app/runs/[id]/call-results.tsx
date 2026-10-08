/**
 * Per-question results of a phone verification call, and the collapsed list of earlier calls.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/call-results.tsx
 * Deps:    react, ./call-panel
 * Tested:  n/a (texts and badges in __tests__/call-panel.test.ts)
 *
 * Key responsibilities:
 * - CallResult: status line, one row per question (badge, STATEMENT tag, question, summary, quote "at m:ss"),
 *   the "said by the candidate" note and the meta line (duration, cost, identity, MOCK)
 * - EarlierCalls: previous calls of the run, collapsed
 *
 * Design constraints:
 * - Pure rendering from props; no verdict word and no score about the candidate
 * - Answers never count as public evidence: the note under the list says so
 */
import { ANSWER_BADGE, type CallView, callPhase, formatAt } from "./call-panel";

export const SAID_NOTE = "Said by the candidate on the phone. This is not public evidence and does not change the research coverage.";

function Meta({ call }: { call: CallView }): React.JSX.Element {
  const identity = call.identity_confirmed === null ? "unknown" : call.identity_confirmed ? "yes" : "no";
  const parts = [
    call.duration_secs === null ? null : `Duration ${formatAt(call.duration_secs)}`,
    `Cost $${call.cost_usd.toFixed(2)}`,
    `Identity confirmed: ${identity}`,
  ].filter((p): p is string => p !== null);
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
      {parts.join(" · ")}
      {call.provider === "mock" && <span className="rounded bg-unsure-bg px-2 py-0.5 text-unsure">MOCK</span>}
    </p>
  );
}

function AnswerRow({ answer }: { answer: NonNullable<CallView["answers"]>[number] }): React.JSX.Element {
  const badge = ANSWER_BADGE[answer.status];
  return (
    <li className="flex flex-col gap-1 border-t border-divider pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
        {answer.status === "answered" && <span className="text-xs font-semibold tracking-wide text-violet-300">STATEMENT</span>}
      </div>
      <p className="text-sm font-medium text-ink">{answer.question}</p>
      {answer.summary !== null && <p className="text-sm text-ink">{answer.summary}</p>}
      {answer.quote !== null && (
        <p className="text-sm text-muted">
          <q className="italic">{answer.quote}</q>
          {answer.at_secs !== null && <span className="ml-2 text-xs">at {formatAt(answer.at_secs)}</span>}
        </p>
      )}
    </li>
  );
}

export function CallResult({ call }: { call: CallView }): React.JSX.Element {
  const phase = callPhase(call);
  const answers = call.answers ?? [];
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <p className={`text-sm ${phase.kind === "ended" && call.status === "failed" ? "text-conflict" : "text-ink"}`}>
        {phase.kind === "calling" || phase.kind === "reading" ? <span className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-action border-t-transparent align-middle" /> : null}
        {phase.text}
      </p>
      {call.identity_confirmed === false && <p className="text-sm text-unsure">The person did not confirm who they are. Nothing was saved.</p>}
      {answers.length > 0 && (
        <>
          <ul className="flex flex-col gap-3">
            {answers.map((a) => (
              <AnswerRow key={a.question_id} answer={a} />
            ))}
          </ul>
          <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">{SAID_NOTE}</p>
        </>
      )}
      {phase.kind !== "calling" && <Meta call={call} />}
    </div>
  );
}

export function EarlierCalls({ calls }: { calls: readonly CallView[] }): React.JSX.Element | null {
  if (calls.length === 0) return null;
  return (
    <details className="border-t border-divider pt-3">
      <summary className="text-sm text-muted hover:text-ink">Earlier calls ({String(calls.length)})</summary>
      <ul className="mt-3 flex flex-col gap-4">
        {calls.map((c) => (
          <li key={c.id} className="flex flex-col gap-1">
            <p className="text-xs text-muted">{(c.approved_at ?? c.created_at).slice(0, 16).replace("T", " ")} · {c.to_number_masked ?? "no number"}</p>
            <CallResult call={c} />
          </li>
        ))}
      </ul>
    </details>
  );
}
