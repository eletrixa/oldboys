/**
 * Export buttons for a finished brief, grouped by audience: Interview, Candidate, ATS, References.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/kit-actions.tsx
 * Deps:    react, ../../ui (Radar tokens), ./interview-kit, ./candidate-copy, ./ats-note, ./reference-check
 * Tested:  n/a (the texts are tested in __tests__/{interview-kit,candidate-copy,ats-note,reference-check}.test.ts)
 *
 * Key responsibilities:
 * - KitActions: build the kit (generatedAt = now) or the candidate notice at click time, copy it or download it as .md
 * - Copy for ATS: a short plain-text note (atsNote) with the link to this brief, for pasting into any ATS card
 * - Copy reference questions: research gaps as plain-text questions for a former manager or colleague (idea #18)
 * - One compact labelled row per audience (small muted label + its buttons)
 * - Short "Copied" / "Copy failed" label on each copy button
 *
 * Design constraints:
 * - Client only; no fetch, every document are built from the RunState already on the page
 * - No alert(); failures show on the button
 */
"use client";

import { useState } from "react";
import { BTN_SECONDARY } from "../../ui";
import type { RunState } from "./state";
import { interviewKit, kitFileName } from "./interview-kit";
import { candidateCopy, noticeFileName } from "./candidate-copy";
import { atsNote } from "./ats-note";
import { referenceQuestions } from "./reference-check";

const BTN = BTN_SECONDARY;
const ROW = "flex flex-wrap items-center gap-2";
const LABEL = "w-20 shrink-0 text-xs font-medium text-muted";

type CopyStatus = "idle" | "copied" | "failed";

const STATUS_LABEL: Record<Exclude<CopyStatus, "idle">, string> = { copied: "Copied", failed: "Copy failed" };

/** Copies `text` and reports the outcome, then resets to idle after 2 s. */
async function copyText(text: string | null, setStatus: (s: CopyStatus) => void): Promise<void> {
  if (text === null) return;
  try {
    await navigator.clipboard.writeText(text);
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
  const [refCopy, setRefCopy] = useState<CopyStatus>("idle");
  if (state.brief === null) return null;

  const kit = (): string | null => interviewKit(state, new Date().toISOString());
  const notice = (): string | null => candidateCopy(state);
  const ats = (): string | null => atsNote(state, `${window.location.origin}/runs/${state.id}`);
  const refs = (): string | null => referenceQuestions(state);

  return (
    <div className="flex flex-col gap-2">
      <div className={ROW}>
        <span className={LABEL}>Interview</span>
        <button type="button" className={BTN} onClick={() => void copyText(kit(), setKitCopy)} aria-live="polite">
          {kitCopy === "idle" ? "Copy interview kit" : STATUS_LABEL[kitCopy]}
        </button>
        <button type="button" className={BTN} onClick={() => { downloadText(kit(), kitFileName(state)); }}>
          Download .md
        </button>
      </div>
      <div className={ROW}>
        <span className={LABEL}>Candidate</span>
        <button type="button" className={BTN} onClick={() => void copyText(notice(), setNoticeCopy)} aria-live="polite">
          {noticeCopy === "idle" ? "Copy candidate notice" : STATUS_LABEL[noticeCopy]}
        </button>
        <button type="button" className={BTN} onClick={() => { downloadText(notice(), noticeFileName(state)); }}>
          Download candidate notice (.md)
        </button>
      </div>
      <div className={ROW}>
        <span className={LABEL}>ATS</span>
        <button type="button" className={BTN} onClick={() => void copyText(ats(), setAtsCopy)} aria-live="polite">
          {atsCopy === "idle" ? "Copy for ATS" : STATUS_LABEL[atsCopy]}
        </button>
      </div>
      <div className={ROW}>
        <span className={LABEL}>References</span>
        <button type="button" className={BTN} onClick={() => void copyText(refs(), setRefCopy)} aria-live="polite">
          {refCopy === "idle" ? "Copy reference questions" : STATUS_LABEL[refCopy]}
        </button>
      </div>
    </div>
  );
}
