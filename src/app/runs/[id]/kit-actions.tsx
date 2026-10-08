/**
 * "Copy interview kit" and "Download .md" buttons for a finished brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/kit-actions.tsx
 * Deps:    react, ./interview-kit
 * Tested:  n/a (the Markdown is tested in __tests__/interview-kit.test.ts)
 *
 * Key responsibilities:
 * - KitActions: build the kit at click time (generatedAt = now), copy it to the clipboard or download it as .md
 * - Short "Copied" / "Copy failed" label on the copy button
 *
 * Design constraints:
 * - Client only; no fetch, the kit is built from the RunState already on the page
 * - No alert(); failures show on the button
 */
"use client";

import { useState } from "react";
import type { RunState } from "./state";
import { interviewKit, kitFileName } from "./interview-kit";

const BTN = "rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800";

type CopyStatus = "idle" | "copied" | "failed";

const COPY_LABEL: Record<CopyStatus, string> = { idle: "Copy interview kit", copied: "Copied", failed: "Copy failed" };

export function KitActions({ state }: { state: RunState }): React.JSX.Element | null {
  const [copy, setCopy] = useState<CopyStatus>("idle");
  if (state.brief === null) return null;

  const copyKit = async (): Promise<void> => {
    const kit = interviewKit(state, new Date().toISOString());
    if (kit === null) return;
    try {
      await navigator.clipboard.writeText(kit);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
    setTimeout(() => {
      setCopy("idle");
    }, 2000);
  };

  const downloadKit = (): void => {
    const kit = interviewKit(state, new Date().toISOString());
    if (kit === null) return;
    const url = URL.createObjectURL(new Blob([kit], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = kitFileName(state);
    // Attached and revoked a tick later: Firefox and Safari can drop a download whose URL is revoked synchronously.
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={BTN} onClick={() => void copyKit()} aria-live="polite">
        {COPY_LABEL[copy]}
      </button>
      <button type="button" className={BTN} onClick={downloadKit}>
        Download .md
      </button>
    </div>
  );
}
