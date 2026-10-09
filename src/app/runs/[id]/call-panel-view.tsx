/**
 * "Verify with the candidate by phone" panel on a finished brief: proposal, consent form, live call, results.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/call-panel-view.tsx
 * Deps:    next/link, react, src/app/login/next-path, src/app/ui (Radar vocabulary), ./call-panel, ./call-setup, ./call-results, ./report-lang (useReport), ./phone-kit-text (types), ./state (types)
 * Tested:  n/a (pure parts in __tests__/call-panel.test.ts)
 *
 * Key responsibilities:
 * - GET /api/runs/:id/calls for the proposal, the call limit and earlier calls; without a cached AI draft
 *   (`ai_proposal`) one POST /api/runs/:id/calls/proposal asks for it when the setup opens (cap 75 s); any failure
 *   keeps the rule-based proposal with a small note
 * - Place: POST /api/runs/:id/calls {language: "en", questions} → POST /api/calls/:id/approve; a draft whose
 *   approve is rejected (400/409) is skipped so it never counts; 401 asks the operator to log in again
 * - Track: GET /api/calls/:id every 3 s until callPhase settles (cap 35 min), then reload the run's calls and tell the page (onChanged)
 * - After a finished call: results first, the setup form folded under "Call again · N of M calls left"
 * - useRunCalls: the same GET for the brief layout (30-second numbers, plan rows, header pill)
 * - Labels, status lines and errors follow the report language (`report.t.call`); the call itself stays English
 *   (`language: "en"`), and error texts the API sends back are shown as they come
 *
 * Design constraints:
 * - Client only; shown only for a done run with a brief; same-origin fetches carry the session cookie, no token
 * - The full number goes only into the approve request body
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { loginHref } from "@/app/login/next-path";
import { CARD, Chevron, LINK, SUMMARY, SimulatedPill } from "@/app/ui";
import { type AiDraft, type CallForm, type CallProposal, type CallView, type RunCalls, callPhase, isSettled, placedCalls, toHrQuestions } from "./call-panel";
import { CallResult, EarlierCalls } from "./call-results";
import { CallSetup } from "./call-setup";
import type { CallUi } from "./phone-kit-text";
import { useReport } from "./report-lang";
import type { RunState } from "./state";

const POLL_MS = 3000;
const POLL_CAP_MS = 35 * 60 * 1000;
const DRAFT_CAP_MS = 75 * 1000;

export type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: RunCalls };

type Action =
  | { kind: "idle" }
  | { kind: "unauthorized" }
  | { kind: "placing" }
  | { kind: "error"; message: string; index: number | null }
  | { kind: "tracking"; callId: string; call: CallView | null };

async function fetchAiDraft(runId: string): Promise<AiDraft> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, DRAFT_CAP_MS);
  try {
    const res = await fetch(`/api/runs/${runId}/calls/proposal`, { method: "POST", cache: "no-store", signal: controller.signal });
    if (!res.ok) return { kind: "rules", note: null };
    const body = await res.json<CallProposal>();
    return body.source === "ai" ? { kind: "ai", proposal: body.proposal } : { kind: "rules", note: body.note };
  } catch {
    return { kind: "rules", note: null };
  } finally {
    clearTimeout(timer);
  }
}

type Placed = { kind: "placed"; callId: string } | { kind: "unauthorized" } | { kind: "error"; message: string; index: number | null };

async function errorOf(res: Response): Promise<{ error?: string; index?: number | null }> {
  try {
    return await res.json<{ error?: string; index?: number | null }>();
  } catch {
    return {};
  }
}

function approveError(t: CallUi, status: number): string {
  return status === 400 || status === 409 || status === 502 ? t.approveError[status] : t.httpFailed(status);
}

async function placeCall(runId: string, form: CallForm, t: CallUi): Promise<Placed> {
  const headers = { "Content-Type": "application/json" };
  const draft = await fetch(`/api/runs/${runId}/calls`, {
    method: "POST",
    headers,
    body: JSON.stringify({ language: "en", questions: toHrQuestions(form.questions) }),
  });
  if (draft.status === 401) return { kind: "unauthorized" };
  if (draft.status !== 201) {
    const e = await errorOf(draft);
    return { kind: "error", message: e.error ?? t.prepareFailed, index: e.index ?? null };
  }
  const { id } = await draft.json<{ id: string }>();
  const approve = await fetch(`/api/calls/${id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ to_number: form.number, consent_ack: true, consent_note: form.note, operator: form.operator }),
  });
  if (approve.status === 401) return { kind: "unauthorized" };
  // 202 placed; 500 with an id means placed but the result workflow did not start (the call view shows last_error).
  if (approve.status === 202 || approve.status === 500) return { kind: "placed", callId: id };
  if (approve.status === 400 || approve.status === 409) {
    await fetch(`/api/calls/${id}/skip`, { method: "POST" }).catch(() => undefined);
  }
  return { kind: "error", message: approveError(t, approve.status), index: null };
}

export async function fetchRunCalls(runId: string): Promise<Load> {
  try {
    const res = await fetch(`/api/runs/${runId}/calls`, { cache: "no-store" });
    return res.ok ? { kind: "ready", data: await res.json<RunCalls>() } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/** The run's calls for the brief layout (numbers, plan rows, header pill); `reload` after the phone panel placed a call. */
export function useRunCalls(runId: string, enabled: boolean): { data: RunCalls | null; reload: () => void } {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [seq, setSeq] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void fetchRunCalls(runId).then((next) => {
      if (live) setLoad(next);
    });
    return () => {
      live = false;
    };
  }, [enabled, runId, seq]);
  const reload = useCallback(() => {
    setSeq((n) => n + 1);
  }, []);
  return { data: load.kind === "ready" ? load.data : null, reload };
}

/** Polls one call until it settles; `onUpdate` gets every view, `onDone` fires once at the end. */
function useCallTracking(callId: string | null, onUpdate: (call: CallView) => void, onDone: (timedOut: boolean) => void): void {
  useEffect(() => {
    if (callId === null) return;
    const id = callId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const started = Date.now();
    async function tick(): Promise<void> {
      try {
        const res = await fetch(`/api/calls/${id}`, { cache: "no-store" });
        if (res.ok) {
          const call = await res.json<CallView>();
          if (stopped) return;
          onUpdate(call);
          if (isSettled(callPhase(call))) {
            onDone(false);
            return;
          }
        }
      } catch {
        // transient network error: try again on the next tick
      }
      if (stopped) return;
      if (Date.now() - started > POLL_CAP_MS) {
        onDone(true);
        return;
      }
      timer = setTimeout(() => void tick(), POLL_MS);
    }
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [callId, onUpdate, onDone]);
}

export function CallPanel({ state, onChanged }: { state: RunState; onChanged?: () => void }): React.JSX.Element | null {
  const report = useReport();
  const t = report.t.call;
  const show = state.status === "done" && state.brief !== null;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [action, setAction] = useState<Action>({ kind: "idle" });
  const [aiDraft, setAiDraft] = useState<AiDraft>({ kind: "drafting" });
  const draftAsked = useRef(false);

  useEffect(() => {
    if (!show) return;
    let live = true;
    void fetchRunCalls(state.id).then((next) => {
      if (live) setLoad(next);
    });
    return () => {
      live = false;
    };
  }, [show, state.id]);

  // One AI draft per page view, only when no cached one came with the GET; the route caches it per research state.
  const needsDraft = load.kind === "ready" && load.data.ai_proposal === null;
  useEffect(() => {
    if (!needsDraft || draftAsked.current) return;
    draftAsked.current = true;
    void fetchAiDraft(state.id).then(setAiDraft);
  }, [needsDraft, state.id]);

  const place = useCallback(
    (form: CallForm) => {
      setAction({ kind: "placing" });
      placeCall(state.id, form, t)
        .then((placed) => {
          setAction(placed.kind === "placed" ? { kind: "tracking", callId: placed.callId, call: null } : placed);
          if (placed.kind === "error") void fetchRunCalls(state.id).then(setLoad).then(onChanged);
        })
        .catch(() => {
          setAction({ kind: "error", message: t.unreachable, index: null });
        });
    },
    [state.id, onChanged, t],
  );

  const onUpdate = useCallback((call: CallView) => {
    setAction((a) => (a.kind === "tracking" && a.callId === call.id ? { ...a, call } : a));
  }, []);
  const onDone = useCallback(
    (timedOut: boolean) => {
      void fetchRunCalls(state.id).then((next) => {
        setLoad(next);
        setAction(timedOut ? { kind: "error", message: t.timedOut, index: null } : { kind: "idle" });
        onChanged?.();
      });
    },
    [state.id, onChanged, t],
  );
  useCallTracking(action.kind === "tracking" ? action.callId : null, onUpdate, onDone);

  if (!show) return null;
  const data = load.kind === "ready" ? load.data : null;
  const placed = data === null ? [] : placedCalls(data.calls);
  const current = action.kind === "tracking" ? action.call : (placed[0] ?? null);
  const earlier = action.kind === "tracking" ? placed : placed.slice(1);
  const draft: AiDraft = data?.ai_proposal ? { kind: "ai", proposal: data.ai_proposal } : aiDraft;
  // After a finished call the results lead and the form for another call folds away.
  const finished = current?.status === "done";
  const setup = (d: RunCalls): React.JSX.Element => (
    <CallSetup
      proposal={draft.kind === "ai" ? draft.proposal : d.proposal}
      draft={draft}
      used={d.used}
      max={d.max}
      busy={action.kind === "placing"}
      errorIndex={action.kind === "error" ? action.index : null}
      onPlace={place}
    />
  );

  return (
    <section className={`${CARD} flex flex-col gap-4 text-ink`} aria-labelledby="phone-verify">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="phone-verify" className="text-lg">{t.title}</h2>
        {data?.provider === "mock" && <SimulatedPill kind="mock" detail={t.mockDetail} />}
      </div>
      <p className="text-sm text-muted">{t.intro}</p>
      {load.kind === "loading" && <p className="text-sm text-muted">{t.loading}</p>}
      {load.kind === "error" && <p className="text-sm text-conflict" role="alert">{t.loadError}</p>}
      {action.kind === "tracking" && action.call === null && <p className="text-sm text-ink" aria-live="polite">{t.placing}</p>}
      {current !== null && <CallResult call={current} />}
      {action.kind === "error" && <p className="text-sm text-conflict" role="alert">{action.message}</p>}
      {action.kind === "unauthorized" && (
        <p className="text-sm text-conflict" role="alert">
          {t.loginExpired}{" "}
          <Link href={loginHref(`/runs/${state.id}`)} className={LINK}>{t.logInAgain}</Link>
        </p>
      )}
      {data !== null && action.kind !== "tracking" && (finished ? (
        <details className="group border-t border-divider pt-2">
          <summary className={SUMMARY}>
            <Chevron />
            {t.callAgain(Math.max(0, data.max - data.used), data.max)}
          </summary>
          <div className="mt-3">{setup(data)}</div>
        </details>
      ) : (
        setup(data)
      ))}
      {data !== null && <p className="text-xs text-muted">{t.usage(data.used, data.max)}</p>}
      <EarlierCalls calls={earlier} />
    </section>
  );
}
