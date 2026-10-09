/**
 * Per-question results of a phone verification call, and the collapsed list of earlier calls.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/call-results.tsx
 * Deps:    react, ./call-panel, ./report-lang (useReport), @/app/ui (SimulatedPill)
 * Tested:  n/a (texts and badges in __tests__/call-panel.test.ts)
 *
 * Key responsibilities:
 * - CallResult: status line, one row per question (badge, STATEMENT tag, question, summary, quote "at m:ss"),
 *   the "said by the candidate" note and the meta line (duration, cost, identity, MOCK)
 * - EarlierCalls: previous calls of the run, collapsed
 * - Labels follow the report language (`report.t.call`, badge words `report.t.ui.answerStatus`); the question, the answer
 *   summary and the quote come from the English call and keep lang="en" when the page is Czech
 *
 * Design constraints:
 * - Pure rendering from props; no verdict word and no score about the candidate
 * - Answers never count as public evidence: the note under the list says so
 */
import { SimulatedPill } from "@/app/ui";
import { ANSWER_BADGE, type CallView, callPhase, formatAt } from "./call-panel";
import { useReport } from "./report-lang";

function Meta({ call }: { call: CallView }): React.JSX.Element {
  const { meta } = useReport().t.call;
  const parts = [
    call.duration_secs === null ? null : meta.duration(formatAt(call.duration_secs)),
    meta.cost(call.cost_usd),
    meta.identity(call.identity_confirmed),
  ].filter((p): p is string => p !== null);
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
      {parts.join(" · ")}
      {call.provider === "mock" && <SimulatedPill kind="mock" />}
    </p>
  );
}

function AnswerRow({ answer }: { answer: NonNullable<CallView["answers"]>[number] }): React.JSX.Element {
  const report = useReport();
  const { t } = report;
  const english = report.lang === "en" ? undefined : "en";
  const badge = ANSWER_BADGE[answer.status];
  return (
    <li className="flex flex-col gap-1 border-t border-divider pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-0.5 text-xs ${badge.cls}`}>{t.ui.answerStatus[answer.status]}</span>
        {answer.status === "answered" && <span className="text-xs font-semibold tracking-wide text-inference">{t.call.statementTag}</span>}
      </div>
      <p className="text-sm font-medium text-ink" lang={english}>{answer.question}</p>
      {answer.summary !== null && <p className="text-sm text-ink" lang={english}>{answer.summary}</p>}
      {answer.quote !== null && (
        <p className="text-sm text-muted">
          <q className="italic" lang={english}>{answer.quote}</q>
          {answer.at_secs !== null && <span className="ml-2 text-xs">{t.ui.at(formatAt(answer.at_secs))}</span>}
        </p>
      )}
    </li>
  );
}

export function CallResult({ call }: { call: CallView }): React.JSX.Element {
  const { t } = useReport();
  const phase = callPhase(call, t.call.phase);
  const answers = call.answers ?? [];
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <p className={`text-sm ${phase.kind === "ended" && call.status === "failed" ? "text-conflict" : "text-ink"}`}>
        {phase.kind === "calling" || phase.kind === "reading" ? <span className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-action border-t-transparent align-middle" /> : null}
        {phase.text}
      </p>
      {call.identity_confirmed === false && <p className="text-sm text-unsure">{t.call.identityNotConfirmed}</p>}
      {answers.length > 0 && (
        <>
          <ul className="flex flex-col gap-3">
            {answers.map((a) => (
              <AnswerRow key={a.question_id} answer={a} />
            ))}
          </ul>
          <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">{t.call.saidNote}</p>
        </>
      )}
      {phase.kind !== "calling" && <Meta call={call} />}
    </div>
  );
}

export function EarlierCalls({ calls }: { calls: readonly CallView[] }): React.JSX.Element | null {
  const { call: t } = useReport().t;
  if (calls.length === 0) return null;
  return (
    <details className="border-t border-divider pt-3">
      <summary className="text-sm text-muted hover:text-ink">{t.earlier(calls.length)}</summary>
      <ul className="mt-3 flex flex-col gap-4">
        {calls.map((c) => (
          <li key={c.id} className="flex flex-col gap-1">
            <p className="text-xs text-muted">{t.earlierAt(c.approved_at ?? c.created_at)} · {c.to_number_masked ?? t.noNumber}</p>
            <CallResult call={c} />
          </li>
        ))}
      </ul>
    </details>
  );
}
