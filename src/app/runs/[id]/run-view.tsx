/**
 * Client view for a run: polls state, shows progress, lineup questions and the finished brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/run-view.tsx
 * Deps:    react, next/link, ../../ui, ./parts, ./state, ./identity-map-card
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Poll GET /api/runs/:id/state every 2 s until done or failed
 * - Header: derived name once the seed step knows it ("the candidate" before), the seed headline under it
 * - When done, the brief comes first and the confirmation steps fold into a closed "How we confirmed it" disclosure
 * - While running show a hint that the brief appears here; no jump link
 * - Audit record link as the last element of the ready view
 * - Show the run cost and research time line (ledger projection) while running and when done
 * - Identity map above the profile list (same live decisions)
 * - On failure keep the progress rows, mark the failed one, show the reason, sources so far and a retry link
 * - Show one question at a time (at most MAX_QUESTIONS) above the lineup, so it is never below the fold; send every
 *   decision in one answer event
 *
 * Design constraints:
 * - Client component; no SSE; "I'm not sure" is answered locally and keeps possibly-same-as
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Candidate, CandidateDecision } from "@/domain/claim";
import { BTN_QUIET, BTN_SECONDARY, CARD_CONFLICT, Eyebrow, LINK, Pill } from "../../ui";
import { IdentityMapCard } from "./identity-map-card";
import { type Answer, BriefView, CostLine, ProfileList, ProgressSteps, QuestionCard } from "./parts";
import { type RunState, firstName, headerText, questionsToAsk, sortLineup, stepRows } from "./state";

const POLL_MS = 2000;
/** Wireframe: one easy question at a time, and never more than a few; the rest keep the server's decision. */
const MAX_QUESTIONS = 3;
/** A finished run older than this is shown as a replay of an earlier run. */
const CACHED_AFTER_MS = 30 * 60_000;

type Decisions = { id: string; decision: Answer }[];

async function sendAnswer(id: string, decisions: Decisions): Promise<boolean> {
  try {
    const res = await fetch(`/api/runs/${id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisions }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Plain-words reason: LLM-seam rows (extract, verify, synthesize) read as the AI step. */
function failureText(state: RunState): string {
  const reason = state.failure ?? "unknown error";
  const llm = stepRows(state).indexOf("failed") >= 3;
  return llm ? `The AI step could not run: ${reason}` : `A research step failed: ${reason}`;
}

export function RunView({ id }: { id: string }): React.JSX.Element {
  const [state, setState] = useState<RunState | null>(null);
  const [missing, setMissing] = useState(false);
  const [local, setLocal] = useState<Record<string, Answer>>({});
  const [unsure, setUnsure] = useState<Record<string, true>>({});
  const autoSent = useRef(false);
  const lastDecisions = useRef<Decisions>([]);
  const [openedAt] = useState(() => Date.now());
  const [sent, setSent] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    async function tick(): Promise<void> {
      let next = true;
      try {
        const res = await fetch(`/api/runs/${id}/state`, { cache: "no-store" });
        if (res.status === 404) {
          setMissing(true);
          next = false;
        } else if (res.ok) {
          const s = await res.json<RunState>();
          setState(s);
          next = s.status !== "done" && s.status !== "failed";
        }
      } catch {
        // transient network error: try again on the next tick
      }
      if (next && !stopped) timer = setTimeout(() => void tick(), POLL_MS);
    }
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);

  const decisionOf = useCallback((c: Candidate): CandidateDecision => local[c.id] ?? c.decision, [local]);

  // The set to ask is stable (derived from server decisions); answered ones drop out of it.
  const pending = questionsToAsk(state?.candidates ?? [], MAX_QUESTIONS).filter((c) => !(c.id in local) && !(c.id in unsure));
  // Only while the Workflow actually waits; after the answers went out the remaining lineup keeps the server's decision
  const question = state?.status === "paused" && !sent && !sendFailed ? pending[0] : undefined;

  const submit = useCallback(
    async (decisions: Decisions) => {
      const ok = await sendAnswer(id, decisions);
      setSent(ok);
      setSendFailed(!ok);
    },
    [id],
  );

  // One answer event resumes the Workflow, so every decision goes in a single send once nothing is pending.
  useEffect(() => {
    if (state?.status !== "paused" || pending.length > 0 || autoSent.current) return;
    const decisions = state.candidates.map((c) => ({ id: c.id, decision: local[c.id] ?? c.decision }));
    if (decisions.length === 0) return;
    autoSent.current = true;
    lastDecisions.current = decisions;
    void sendAnswer(id, decisions).then((ok) => {
      setSent(ok);
      setSendFailed(!ok);
    });
  }, [state, pending.length, local, id]);

  const answer = useCallback((cid: string, decision: Answer) => {
    if (decision === "possibly-same-as") {
      setUnsure((u) => ({ ...u, [cid]: true }));
      return;
    }
    setLocal((l) => ({ ...l, [cid]: decision }));
  }, []);

  if (missing) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10 md:py-14">
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">We could not find this brief</h1>
        <p className="text-muted">The link may be mistyped, or the run is no longer available.</p>
        <Link href="/" className={`${LINK} w-fit`}>Back to home</Link>
      </main>
    );
  }
  if (!state) {
    return (
      <main className="mx-auto flex max-w-3xl animate-pulse flex-col gap-4 px-4 py-10 md:py-14" aria-busy="true">
        <span className="sr-only">Loading...</span>
        <div className="h-8 w-2/3 rounded bg-divider" />
        <div className="h-4 w-1/2 rounded bg-divider" />
      </main>
    );
  }

  const first = firstName(state.subject) ?? "the candidate";
  const created = Date.parse(state.created_at);
  const cached = state.status === "done" && !Number.isNaN(created) && openedAt - created > CACHED_AFTER_MS;
  const degraded = state.brief !== null && state.brief.degraded !== null;
  const labels = [
    state.mentions === 0 ? "Searching public sources (Google can take up to 2 minutes)" : `Found ${String(state.mentions)} public ${state.mentions === 1 ? "mention" : "mentions"}`,
    `Making sure we have the right ${firstName(state.subject) ?? "person"}`,
    degraded ? "Reading their work history and projects (skipped: AI unavailable)" : "Reading their work history and projects",
    degraded ? "Double-checking facts against each other (skipped: AI unavailable)" : "Double-checking facts against each other",
    "Writing your brief",
  ];

  const progress = <ProgressSteps rows={stepRows({ ...state, degraded })} labels={labels} stepIndex={state.step_index} stepCount={state.step_count} />;
  const failed = state.status === "failed" && (
    <div role="alert" className={`${CARD_CONFLICT} flex flex-col gap-2 text-sm text-conflict`}>
      <p>{failureText(state)}</p>
      {state.mentions > 0 && <p>We still found {String(state.mentions)} public {state.mentions === 1 ? "mention" : "mentions"}.</p>}
      <Link href="/" className={`${LINK} w-fit`}>Try again</Link>
    </div>
  );
  const identity = (
    <>
      {question !== undefined && <QuestionCard key={question.id} candidate={question} first={first} onAnswer={answer} />}
      {state.candidates.length > 1 && <IdentityMapCard candidates={state.candidates} decisionOf={decisionOf} first={first} />}
      {state.candidates.length > 0 && <ProfileList candidates={sortLineup(state.candidates, decisionOf)} decisionOf={decisionOf} />}
    </>
  );
  const sendRows = (
    <>
      {sendFailed && (
        <p role="alert" className="flex items-center gap-3 text-sm text-conflict">
          We could not send your answers.
          <button type="button" className={BTN_SECONDARY} onClick={() => {
              setSendFailed(false);
              void submit(lastDecisions.current);
            }}>
            Try again
          </button>
        </p>
      )}
      {sent && !sendFailed && state.status === "paused" && <p className="text-sm text-muted">Thanks, continuing...</p>}
    </>
  );
  const briefFirst = state.status === "done" && state.brief !== null;
  const running = state.status !== "done" && state.status !== "failed";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3 border-b border-divider pb-8">
        <Eyebrow>{state.status === "done" ? "Candidate brief" : "Research in progress"}</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">
          {headerText(state.subject, state.status === "done")}
        </h1>
        {state.headline !== null && <p className="text-lg text-muted">{state.headline}</p>}
        {state.status !== "done" && (
          <p className="text-sm text-muted">This usually takes 2 to 4 minutes. Keep this tab open.</p>
        )}
        {cached && (
          <Pill tone="neutral" className="w-fit">
            CACHED · run from {new Date(state.created_at).toLocaleString()}
          </Pill>
        )}
        <CostLine cost={state.cost} />
      </header>
      {briefFirst ? (
        <>
          <BriefView state={state} />
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
              How we confirmed it is {first}
            </summary>
            <div className="mt-4 flex flex-col gap-8">
              {progress}
              {identity}
              {sendRows}
            </div>
          </details>
        </>
      ) : (
        <>
          {progress}
          {failed}
          {identity}
          {sendRows}
        </>
      )}
      <Link href="/" className={`${BTN_QUIET} self-start`}>Back to home</Link>
      {running && <p className="text-sm text-muted">The brief appears here when the research is done.</p>}
      {!briefFirst && <BriefView state={state} />}
      <Link href={`/runs/${id}/audit`} className="self-start text-xs text-muted underline-offset-4 hover:text-ink hover:underline">
        Audit record
      </Link>
    </main>
  );
}
