/**
 * Client view for a run: polls state, shows progress, lineup questions and the finished brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/run-view.tsx
 * Deps:    react, next/link, ../../ui, ./parts, ./brief-page, ./state, ./identity-map-card, ./delete-card, ./issues-card
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Poll GET /api/runs/:id/state every 2 s until done or failed
 * - Header: derived name once the seed step knows it ("the candidate" before), the seed headline under it,
 *   then "From <source> · <tag> · <date>" when an intake application started the run
 * - "Researched for: <position title>" link to /positions/<id> under the name when the run came from a position
 * - When done with a brief, the whole page is BriefPage (brief-page.tsx: header with hiring steps, tabs, kit sidebar); the
 *   confirmation steps (progress, identity map, profile list) go into its "How we confirmed it" disclosure (Sources tab)
 * - One footer closes the page: running hint (not done, with a /guide#read link), then "Home" and "Audit record" links, then the
 *   "Delete candidate data" disclosure (any status); after a delete the whole page becomes the deletion receipt
 * - Not-found view: eyebrow, heading, muted sentence and a primary back link on the header rhythm
 * - Stalled notice above the progress when no ledger activity for 30 minutes (stalledNotice); the progress panel
 *   (progress-panel.tsx, plans/015) says how much is left, what is read now and what was found, ticking once a second (useNow)
 * - Show the run cost and research time line (ledger projection) while running and when done
 * - Identity map above the profile list (same live decisions)
 * - On failure keep the progress rows, mark the failed one, show the reason, sources so far and a retry link
 * - "Issues so far" (IssuesCard) under the progress while the run is not done: failed requests, skipped sources,
 *   empty searches and AI off, with counts, so a problem shows as it happens and not only when the run dies
 * - Show one question at a time (at most LINEUP_MAX_QUESTIONS) above the lineup, so it is never below the fold; send every
 *   decision in one answer event
 *
 * Design constraints:
 * - Client component; no SSE; "I'm not sure" is answered locally and keeps possibly-same-as
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { trackRun } from "@/app/_components/run-tray-store";
import { intakeLine } from "@/app/intake/intake-rows";
import type { Candidate, CandidateDecision } from "@/domain/claim";
import { BTN_SECONDARY, CARD_CONFLICT, CARD_UNSURE, Eyebrow, LINK, SimulatedPill } from "../../ui";
import type { DeletionReceipt } from "@/domain/deletion";
import { BriefPage, BriefView } from "./brief-page";
import { DeleteCard, DeletedView } from "./delete-card";
import { IdentityMapCard } from "./identity-map-card";
import { IssuesCard } from "./issues-card";
import { useNow } from "@/app/_components/use-now";
import { type Answer, CostLine, ProfileList, QuestionCard } from "./parts";
import { ProgressPanel } from "./progress-panel";
import { LINEUP_MAX_QUESTIONS, type RunState, clockSkew, firstName, headerText, questionsToAsk, retryHref, sortLineup, stalledNotice, stepRows } from "./state";

const POLL_MS = 2000;
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
  const [deleted, setDeleted] = useState<DeletionReceipt | null>(null);
  const thanksRef = useRef<HTMLParagraphElement>(null);
  const live = state !== null && state.status !== "done" && state.status !== "failed";
  const [skew, setSkew] = useState(0);
  const nowMs = useNow(live) - skew;

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
          setSkew(clockSkew(s, Date.now()));
          setState(s);
          if (s.status !== "done" && s.status !== "failed") trackRun(id);
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
  const pending = questionsToAsk(state?.candidates ?? [], LINEUP_MAX_QUESTIONS).filter((c) => !(c.id in local) && !(c.id in unsure));
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

  // After the last answer the question card disappears; move focus to the confirmation so keyboard users are not dropped.
  useEffect(() => {
    if (question === undefined && sent) thanksRef.current?.focus();
  }, [question, sent]);

  const answer = useCallback((cid: string, decision: Answer) => {
    if (decision === "possibly-same-as") {
      setUnsure((u) => ({ ...u, [cid]: true }));
      return;
    }
    setLocal((l) => ({ ...l, [cid]: decision }));
  }, []);

  if (deleted !== null) return <DeletedView receipt={deleted} />;
  if (missing) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-10 md:py-14">
        <Eyebrow>Brief</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">We could not find this brief</h1>
        <p className="text-muted">The link may be mistyped, or the run is no longer available.</p>
        <Link href="/" className={LINK}>Home</Link>
      </main>
    );
  }
  if (!state) {
    return (
      <main className="mx-auto flex max-w-3xl motion-safe:animate-pulse flex-col gap-4 px-4 py-10 md:py-14" aria-busy="true">
        <span className="sr-only">Loading</span>
        <div className="h-3 w-24 rounded bg-divider" />
        <div className="h-10 w-2/3 rounded bg-divider" />
        <div className="h-4 w-1/2 rounded bg-divider" />
      </main>
    );
  }

  const first = firstName(state.subject) ?? "the candidate";
  const forPosition = state.position ?? null;
  const created = Date.parse(state.created_at);
  const cached = state.status === "done" && !Number.isNaN(created) && openedAt - created > CACHED_AFTER_MS;
  const degraded = state.brief !== null && state.brief.degraded !== null;
  const running = state.status !== "done" && state.status !== "failed";
  const stalled = stalledNotice(state, new Date(nowMs).toISOString());
  const progress = <ProgressPanel state={state} nowMs={nowMs} degraded={degraded} />;
  const failed = state.status === "failed" && (
    <div role="alert" className={`${CARD_CONFLICT} flex flex-col gap-2 text-sm text-conflict`}>
      <p>{failureText(state)}</p>
      {state.mentions > 0 && <p>We still found {String(state.mentions)} public {state.mentions === 1 ? "mention" : "mentions"}.</p>}
      <Link href={retryHref(forPosition)} className={`${LINK} w-fit`}>Try again</Link>
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
      {sent && !sendFailed && state.status === "paused" && <p ref={thanksRef} tabIndex={-1} role="status" className="text-sm text-muted">Thanks, continuing…</p>}
    </>
  );
  if (state.status === "done" && state.brief !== null) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col px-4 pt-10 pb-28 md:pt-14 lg:pb-14">
        <BriefPage
          state={state}
          brief={state.brief}
          cached={cached}
          first={first}
          onDeleted={setDeleted}
          confirmation={
            <>
              {progress}
              {identity}
              {sendRows}
            </>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3 border-b border-divider pb-8">
        <Eyebrow>{state.status === "done" ? "Candidate brief" : "Research in progress"}</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">
          {headerText(state.subject, state.status === "done")}
        </h1>
        {state.headline !== null && <p className="text-lg text-muted">{state.headline}</p>}
        {state.intake !== null && <p className="text-sm text-muted">{intakeLine(state.intake)}</p>}
        {forPosition !== null && (
          <p className="text-sm text-muted">
            <Link href={`/positions/${encodeURIComponent(forPosition.id)}`} className={LINK}>Researched for: {forPosition.title}</Link>
          </p>
        )}
        {state.status !== "done" && (
          <p className="text-sm text-muted">The steps below say how much is left. You can leave this page; the panel at the bottom follows the research and the brief waits in My briefs. <Link href="/guide#read" className={LINK}>How to read your brief</Link></p>
        )}
        {cached && (
          <SimulatedPill kind="cached" detail={`run from ${state.created_at.slice(0, 16).replace("T", " ")} UTC`} className="w-fit" />
        )}
        <CostLine cost={state.cost} />
      </header>
      {stalled !== null && (
        <div role="status" className={`${CARD_UNSURE} text-sm`}>
          No progress for 30 minutes. The run was probably interrupted;{" "}
          <Link href={stalled.href} className={LINK}>start it again</Link> from the position or My briefs.
        </div>
      )}
      {progress}
      {failed}
      <IssuesCard issues={state.issues ?? []} />
      {identity}
      {sendRows}
      <BriefView state={state} />
      {running && <p className="text-sm text-muted">The brief appears here when the research is done.</p>}
      <div className="flex items-center gap-6 border-t border-divider pt-6 text-sm">
        <Link href="/" className={LINK}>Home</Link>
        <Link href={`/runs/${id}/audit`} className={LINK}>Audit record</Link>
      </div>
      <DeleteCard runId={id} onDeleted={setDeleted} />
    </main>
  );
}
