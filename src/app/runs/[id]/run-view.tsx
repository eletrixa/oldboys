/**
 * Client view for a run: polls state, shows progress, lineup questions and the finished brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/run-view.tsx
 * Deps:    react, next/link, ./parts, ./state
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Poll GET /api/runs/:id/state every 2 s until done or failed
 * - Show the run cost and research time line (ledger projection) while running and when done
 * - On failure keep the progress rows, mark the failed one, show the reason, sources so far and a retry link
 * - Show the lineup, then one question at a time (at most MAX_QUESTIONS); send every decision in one answer event
 *
 * Design constraints:
 * - Client component; no SSE; "I'm not sure" is answered locally and keeps possibly-same-as
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Candidate, CandidateDecision } from "@/domain/claim";
import { type Answer, BriefView, CostLine, ProfileList, ProgressSteps, QuestionCard } from "./parts";
import { type RunState, questionsToAsk, sortLineup, stepRows } from "./state";

const POLL_MS = 2000;
/** Wireframe: one easy question at a time, and never more than a few; the rest keep the server's decision. */
const MAX_QUESTIONS = 3;

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
  const question = pending[0];

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
      <main className="mx-auto max-w-xl px-4 py-16">
        <p>We could not find this brief.</p>
        <Link href="/" className="text-teal-400 underline">Back</Link>
      </main>
    );
  }
  if (!state) return <main className="mx-auto max-w-2xl px-4 py-10 text-zinc-400">Loading...</main>;

  const first = state.subject.split(/\s+/)[0] ?? state.subject;
  const labels = [
    state.mentions === 0 ? "Searching public sources" : `Found ${String(state.mentions)} public ${state.mentions === 1 ? "mention" : "mentions"}`,
    `Making sure we have the right ${first}`,
    "Reading their work history and projects",
    "Double-checking facts against each other",
    "Writing your brief",
  ];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {state.status === "done" ? `${first}'s brief` : `Putting together ${first}'s brief`}
        </h1>
        {state.status !== "done" && (
          <p className="text-zinc-400">This usually takes 2 to 4 minutes. Keep this tab open.</p>
        )}
        <CostLine cost={state.cost} />
      </header>
      <ProgressSteps rows={stepRows(state)} labels={labels} stepIndex={state.step_index} stepCount={state.step_count} />
      {state.status === "failed" && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          <p>{failureText(state)}</p>
          {state.mentions > 0 && <p className="text-red-300/80">We still found {String(state.mentions)} public {state.mentions === 1 ? "mention" : "mentions"}.</p>}
          <Link href="/" className="font-semibold text-teal-400 underline">Try again</Link>
        </div>
      )}
      {state.candidates.length > 0 && <ProfileList candidates={sortLineup(state.candidates, decisionOf)} decisionOf={decisionOf} />}
      {question !== undefined && <QuestionCard key={question.id} candidate={question} first={first} onAnswer={answer} />}
      {sendFailed && (
        <p role="alert" className="flex items-center gap-3 text-sm text-red-300">
          We could not send your answers.
          <button type="button" className="rounded-lg border border-red-800 px-3 py-1 hover:bg-red-950" onClick={() => {
              setSendFailed(false);
              void submit(lastDecisions.current);
            }}>
            Try again
          </button>
        </p>
      )}
      {sent && !sendFailed && state.status === "paused" && <p className="text-sm text-zinc-400">Thanks, continuing...</p>}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-400 underline">Back</Link>
        {state.brief !== null ? (
          <a
            href="#brief"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("brief")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="rounded-xl bg-teal-500 px-5 py-3 font-semibold text-zinc-950 hover:bg-teal-400"
          >
            See the brief
          </a>
        ) : (
          <button type="button" disabled className="rounded-xl bg-teal-500 px-5 py-3 font-semibold text-zinc-950 opacity-40">See the brief</button>
        )}
      </div>
      <BriefView state={state} />
    </main>
  );
}
