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
 * - Send lineup answers to POST /api/runs/:id/answer; auto-send the rest once no questions remain
 *
 * Design constraints:
 * - Client component; no SSE; "I'm not sure" is answered locally and keeps possibly-same-as
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Candidate, CandidateDecision } from "@/domain/claim";
import { type Answer, BriefView, ProfileList, ProgressSteps, QuestionCard } from "./parts";
import { type RunState, stepRows } from "./state";

const POLL_MS = 2000;

async function sendAnswer(id: string, decisions: { id: string; decision: Answer }[]): Promise<void> {
  await fetch(`/api/runs/${id}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decisions }),
  });
}

export function RunView({ id }: { id: string }): React.JSX.Element {
  const [state, setState] = useState<RunState | null>(null);
  const [missing, setMissing] = useState(false);
  const [local, setLocal] = useState<Record<string, Answer>>({});
  const [unsure, setUnsure] = useState<Record<string, true>>({});
  const autoSent = useRef(false);

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

  const pending = (state?.candidates ?? []).filter((c) => c.decision === "possibly-same-as" && !(c.id in local) && !(c.id in unsure));

  useEffect(() => {
    if (state?.status !== "paused" || pending.length > 0 || autoSent.current) return;
    const decisions = state.candidates
      .filter((c) => !(c.id in local))
      .map((c) => ({ id: c.id, decision: c.decision }));
    if (decisions.length === 0) return;
    autoSent.current = true;
    void sendAnswer(id, decisions);
  }, [state, pending.length, local, id]);

  const answer = useCallback(
    (cid: string, decision: Answer) => {
      if (decision === "possibly-same-as") {
        setUnsure((u) => ({ ...u, [cid]: true }));
        return;
      }
      setLocal((l) => ({ ...l, [cid]: decision }));
      void sendAnswer(id, [{ id: cid, decision }]);
    },
    [id],
  );

  if (missing) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <p>We could not find this brief.</p>
        <Link href="/" className="text-teal-400 underline">Back</Link>
      </main>
    );
  }
  if (!state) return <main className="mx-auto max-w-xl px-4 py-16 text-zinc-400">Loading...</main>;

  const first = state.subject.split(/\s+/)[0] ?? state.subject;
  const labels = [
    `Found ${String(state.mentions)} public mentions`,
    `Making sure we have the right ${first}`,
    "Reading their work history and projects",
    "Double-checking facts against each other",
    "Writing your brief",
  ];

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {state.status === "done" ? `${first}'s brief` : `Putting together ${first}'s brief`}
        </h1>
        {state.status !== "done" && (
          <p className="text-zinc-400">You can leave this page. We will let you know when it is ready.</p>
        )}
      </header>
      {state.status === "failed" ? (
        <p role="alert" className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          Something went wrong while putting this brief together. Please start a new one.
        </p>
      ) : (
        <ProgressSteps rows={stepRows(state)} labels={labels} />
      )}
      {pending.map((c) => (
        <QuestionCard key={c.id} candidate={c} onAnswer={answer} />
      ))}
      {state.candidates.length > 0 && <ProfileList candidates={state.candidates} decisionOf={decisionOf} />}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-400 underline">Back</Link>
        {state.status === "done" ? (
          <a href="#brief" className="rounded-xl bg-teal-500 px-5 py-3 font-semibold text-zinc-950 hover:bg-teal-400">See the brief</a>
        ) : (
          <button type="button" disabled className="rounded-xl bg-teal-500 px-5 py-3 font-semibold text-zinc-950 opacity-40">See the brief</button>
        )}
      </div>
      <BriefView state={state} />
    </main>
  );
}
