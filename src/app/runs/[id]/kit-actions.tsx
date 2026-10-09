/**
 * Export actions for a finished brief: one "Copy interview kit" button plus a "More exports" disclosure.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/kit-actions.tsx
 * Deps:    react, ../../ui (Radar tokens), ./call-panel (types), ./interview-kit, ./candidate-copy, ./ats-note, ./reference-check, ./kit-review-card, ./invite-form, ./report-lang (LANG_BTN)
 * Tested:  n/a (the texts are tested in __tests__/{interview-kit,candidate-copy,ats-note,reference-check}.test.ts)
 *
 * Key responsibilities:
 * - KitActions: build the kit (generatedAt = now) or the candidate notice at click time, copy it or download it as .md
 * - Candidate notice: an "EN | CZ" switch inside the disclosure (local state, default EN) picks the language of the copied and downloaded notice
 * - Copy for ATS: a short plain-text note (atsNote) with the link to this brief, for pasting into any ATS card
 * - Copy reference questions: research gaps as plain-text questions for a former manager or colleague (idea #18)
 * - KitReviewCard below the row: paste the filled kit back after the interview to see the open points (idea #23, client only)
 * - InviteForm below it: download the interview as a calendar invite (.ics) with the brief inside (idea #22, client only)
 * - One top-aligned row: primary copy button + "More exports" disclosure (group/chevron from ui.tsx); opening it never moves the button
 * - One sr-only role="status" span reports "Copied" / "Copy failed" for the last copy that ran; that button's label shows it too for 2 s
 * - EN/CZ buttons are 44px targets (LANG_BTN, shared with the report language switch); the row carries the brief tail's divider
 * - The exports stay English when the brief is shown in Czech (idea #24 covers the page only)
 * - The kit fetches GET /api/runs/:id/calls at click time for the phone verification section; on any error
 *   the kit is built without it
 *
 * Design constraints:
 * - Client only; the only fetch is the run's calls for the kit, everything else comes from the RunState on the page
 * - No alert(); failures are announced in the status span
 */
"use client";

import { useState } from "react";
import { BTN_QUIET, BTN_SECONDARY, Chevron, SUMMARY } from "../../ui";
import type { CallView, RunCalls } from "./call-panel";
import type { RunState } from "./state";
import { interviewKit, kitFileName } from "./interview-kit";
import { candidateCopy, noticeFileName, type NoticeLang } from "./candidate-copy";
import { atsNote } from "./ats-note";
import { referenceQuestions } from "./reference-check";
import { KitReviewCard } from "./kit-review-card";
import { InviteForm } from "./invite-form";
import { LANG_BTN } from "./report-lang";

const LANGS: readonly { lang: NoticeLang; label: string; title: string }[] = [
  { lang: "en", label: "EN", title: "Candidate notice in English" },
  { lang: "cs", label: "CZ", title: "Candidate notice in Czech" },
];

type CopyStatus = "idle" | "copied" | "failed";

/** The run's calls for the kit's phone verification section; [] on any error. */
async function runCalls(runId: string): Promise<CallView[]> {
  try {
    const res = await fetch(`/api/runs/${runId}/calls`, { cache: "no-store" });
    return res.ok ? (await res.json<RunCalls>()).calls : [];
  } catch {
    return [];
  }
}

const STATUS_LABEL: Record<Exclude<CopyStatus, "idle">, string> = { copied: "Copied", failed: "Copy failed" };

/** Button label: swaps to the outcome for 2 s after this button's own copy ran. */
const labelFor = (active: boolean, status: CopyStatus, label: string): string => (active && status !== "idle" ? STATUS_LABEL[status] : label);

/** Copies `text` (or what the promise resolves to) and reports the outcome, then resets to idle after 2 s. */
async function copyText(text: string | null | Promise<string | null>, setStatus: (s: CopyStatus) => void): Promise<void> {
  try {
    const value = await text;
    if (value === null) return;
    await navigator.clipboard.writeText(value);
    setStatus("copied");
  } catch {
    setStatus("failed");
  }
  setTimeout(() => {
    setStatus("idle");
  }, 2000);
}

function downloadText(text: string | null, fileName: string): void {
  if (text === null) return;
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  // Attached and revoked a tick later: Firefox and Safari can drop a download whose URL is revoked synchronously.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function KitActions({ state }: { state: RunState }): React.JSX.Element | null {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [last, setLast] = useState<"kit" | "notice" | "ats" | "refs">("kit");
  const setCopy = (which: typeof last) => (s: CopyStatus): void => {
    setLast(which);
    setStatus(s);
  };
  const [noticeLang, setNoticeLang] = useState<NoticeLang>("en");
  if (state.brief === null) return null;

  const kit = async (): Promise<string | null> => interviewKit(state, new Date().toISOString(), await runCalls(state.id));
  const notice = (): string | null => candidateCopy(state, noticeLang);
  const ats = (): string | null => atsNote(state, `${window.location.origin}/runs/${state.id}`);
  const refs = (): string | null => referenceQuestions(state);

  const item = "w-full justify-start";
  const exportBtn = `${BTN_QUIET} ${item}`;
  return (
    <div className="flex flex-col gap-2 border-t border-divider pt-6">
      <div className="flex flex-wrap items-start gap-2">
        <button type="button" className={BTN_SECONDARY} onClick={() => void copyText(kit(), setCopy("kit"))}>
          {labelFor(last === "kit", status, "Copy interview kit")}
        </button>
        <details className="group relative">
          <summary className={`${SUMMARY} ${BTN_QUIET}`}>
            <Chevron />
            More exports
          </summary>
          <div className="mt-2 flex flex-col divide-y divide-divider rounded-lg border border-divider bg-surface">
            <button type="button" className={exportBtn} onClick={() => void kit().then((text) => { downloadText(text, kitFileName(state)); })}>
              Download .md
            </button>
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="flex gap-1" role="group" aria-label="Candidate notice language">
                {LANGS.map((l) => (
                  <button
                    key={l.lang}
                    type="button"
                    className={LANG_BTN}
                    aria-pressed={noticeLang === l.lang}
                    title={l.title}
                    onClick={() => { setNoticeLang(l.lang); }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted">Candidate notice language</span>
            </div>
            <button type="button" className={exportBtn} onClick={() => void copyText(notice(), setCopy("notice"))}>
              {labelFor(last === "notice", status, "Copy candidate notice")}
            </button>
            <button type="button" className={exportBtn} onClick={() => { downloadText(notice(), noticeFileName(state, noticeLang)); }}>
              Download candidate notice (.md)
            </button>
            <button type="button" className={exportBtn} onClick={() => void copyText(ats(), setCopy("ats"))}>
              {labelFor(last === "ats", status, "Copy for ATS")}
            </button>
            <button type="button" className={exportBtn} onClick={() => void copyText(refs(), setCopy("refs"))}>
              {labelFor(last === "refs", status, "Copy reference questions")}
            </button>
          </div>
        </details>
      </div>
      <KitReviewCard />
      <InviteForm state={state} />
      <span role="status" className="sr-only">
        {status === "idle" ? "" : STATUS_LABEL[status]}
      </span>
    </div>
  );
}
