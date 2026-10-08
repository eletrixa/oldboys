/**
 * Interview kit and candidate notice buttons for a finished brief: copy to the clipboard or download as .md.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/kit-actions.tsx
 * Deps:    react, ./interview-kit, ./candidate-copy, ./ats-note
 * Tested:  n/a (the texts are tested in __tests__/interview-kit.test.ts, __tests__/candidate-copy.test.ts and __tests__/ats-note.test.ts)
 *
 * Key responsibilities:
 * - KitActions: build the kit (generatedAt = now) or the candidate notice at click time, copy it or download it as .md
 * - Copy for ATS: a short plain-text note (atsNote) with the link to this brief, for pasting into any ATS card
 * - Short "Copied" / "Copy failed" label on each copy button
 * - The kit fetches GET /api/runs/:id/calls at click time for the phone verification section; on any error
 *   the kit is built without it
 *
 * Design constraints:
 * - Client only; the only fetch is the run's calls for the kit, everything else comes from the RunState on the page
 * - No alert(); failures show on the button
 */
"use client";

import { useState } from "react";
import type { CallView, RunCalls } from "./call-panel";
import type { RunState } from "./state";
import { interviewKit, kitFileName } from "./interview-kit";
import { candidateCopy, noticeFileName } from "./candidate-copy";
import { atsNote } from "./ats-note";

const BTN = "rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800";

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
  const [kitCopy, setKitCopy] = useState<CopyStatus>("idle");
  const [noticeCopy, setNoticeCopy] = useState<CopyStatus>("idle");
  const [atsCopy, setAtsCopy] = useState<CopyStatus>("idle");
  if (state.brief === null) return null;

  const kit = async (): Promise<string | null> => interviewKit(state, new Date().toISOString(), await runCalls(state.id));
  const notice = (): string | null => candidateCopy(state);
  const ats = (): string | null => atsNote(state, `${window.location.origin}/runs/${state.id}`);

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={BTN} onClick={() => void copyText(kit(), setKitCopy)} aria-live="polite">
        {kitCopy === "idle" ? "Copy interview kit" : STATUS_LABEL[kitCopy]}
      </button>
      <button type="button" className={BTN} onClick={() => void kit().then((text) => { downloadText(text, kitFileName(state)); })}>
        Download .md
      </button>
      <button type="button" className={BTN} onClick={() => void copyText(notice(), setNoticeCopy)} aria-live="polite">
        {noticeCopy === "idle" ? "Copy candidate notice" : STATUS_LABEL[noticeCopy]}
      </button>
      <button type="button" className={BTN} onClick={() => { downloadText(notice(), noticeFileName(state)); }}>
        Download candidate notice (.md)
      </button>
      <button type="button" className={BTN} onClick={() => void copyText(ats(), setAtsCopy)} aria-live="polite">
        {atsCopy === "idle" ? "Copy for ATS" : STATUS_LABEL[atsCopy]}
      </button>
    </div>
  );
}
