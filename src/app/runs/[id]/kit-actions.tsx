/**
 * Interview kit and candidate notice buttons for a finished brief: copy to the clipboard or download as .md.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/kit-actions.tsx
 * Deps:    react, ./interview-kit, ./candidate-copy
 * Tested:  n/a (the Markdown is tested in __tests__/interview-kit.test.ts and __tests__/candidate-copy.test.ts)
 *
 * Key responsibilities:
 * - KitActions: build the kit (generatedAt = now) or the candidate notice at click time, copy it or download it as .md
 * - Short "Copied" / "Copy failed" label on each copy button
 *
 * Design constraints:
 * - Client only; no fetch, both documents are built from the RunState already on the page
 * - No alert(); failures show on the button
 */
"use client";

import { useState } from "react";
import type { RunState } from "./state";
import { interviewKit, kitFileName } from "./interview-kit";
import { candidateCopy, noticeFileName } from "./candidate-copy";

const BTN = "rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800";

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
  if (state.brief === null) return null;

  const kit = (): string | null => interviewKit(state, new Date().toISOString());
  const notice = (): string | null => candidateCopy(state);

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={BTN} onClick={() => void copyText(kit(), setKitCopy)} aria-live="polite">
        {kitCopy === "idle" ? "Copy interview kit" : STATUS_LABEL[kitCopy]}
      </button>
      <button type="button" className={BTN} onClick={() => { downloadText(kit(), kitFileName(state)); }}>
        Download .md
      </button>
      <button type="button" className={BTN} onClick={() => void copyText(notice(), setNoticeCopy)} aria-live="polite">
        {noticeCopy === "idle" ? "Copy candidate notice" : STATUS_LABEL[noticeCopy]}
      </button>
      <button type="button" className={BTN} onClick={() => { downloadText(notice(), noticeFileName(state)); }}>
        Download candidate notice (.md)
      </button>
    </div>
  );
}
