/**
 * Landing hero: an interactive evidence example (requirement → evidence → question) with a short walk-through.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/evidence-example.tsx
 * Deps:    react, ../ui, ./evidence-data, ./evidence-steps
 * Tested:  e2e/home.spec.ts (tabs switch, "Show evidence" opens and closes)
 *
 * Key responsibilities:
 * - Three tabs, one per coverage word (evidenced / partial / none), arrow keys move between them
 * - The finished state renders first; the walk-through (~10 s, Replay) only moves emphasis down the thread:
 *   requirement, then the quote highlight and status, then the question built from the open point
 * - Autoplays once when half visible, stops when scrolled away, never under prefers-reduced-motion
 *
 * Design constraints:
 * - All three panels share one grid cell, so switching tabs never shifts the layout
 * - Timers are cleared on every change and on unmount; no perpetual animation
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EXAMPLES } from "./evidence-data";
import { Steps } from "./evidence-steps";

export type Phase = 0 | 1 | 2 | 3;

const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function PlayIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
      <path d="M8 5.8v12.4L18 12z" />
    </svg>
  );
}

export function EvidenceExample(): React.JSX.Element {
  const [sel, setSel] = useState(1);
  const [phase, setPhase] = useState<Phase>(0);
  const [checking, setChecking] = useState(false);
  const timers = useRef<number[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const stop = useCallback((): void => {
    timers.current.forEach((t) => { window.clearTimeout(t); });
    timers.current = [];
    setPhase(0);
    setChecking(false);
  }, []);

  const play = useCallback((): void => {
    stop();
    const at: readonly [number, number, number, number] = reducedMotion() ? [1800, 2400, 3600, 5400] : [2600, 4100, 6400, 10200];
    const later = (ms: number, fn: () => void): void => { timers.current.push(window.setTimeout(fn, ms)); };
    setPhase(1);
    later(at[0], () => { setPhase(2); setChecking(true); });
    later(at[1], () => { setChecking(false); });
    later(at[2], () => { setPhase(3); });
    later(at[3], () => { setPhase(0); });
  }, [stop]);

  useEffect(() => {
    const el = card.current;
    if (el === null) return undefined;
    let played = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) { stop(); continue; }
          if (played || reducedMotion()) continue;
          played = true;
          timers.current.push(window.setTimeout(play, 1400));
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => { io.disconnect(); timers.current.forEach((t) => { window.clearTimeout(t); }); };
  }, [play, stop]);

  const choose = (i: number, focus: boolean): void => {
    stop();
    setSel(i);
    if (focus) tabs.current[i]?.focus();
  };

  const onKey = (e: React.KeyboardEvent, i: number): void => {
    const n = EXAMPLES.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    choose(next, true);
  };

  const running = phase !== 0;
  return (
    <div ref={card} className="overflow-hidden rounded-2xl border border-divider bg-[#fffefb] shadow-[0_1px_2px_rgba(40,45,43,0.05),0_24px_60px_rgba(40,45,43,0.10)]">
      <div className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3 sm:px-5">
        <span className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">Interactive example · fictional candidate</span>
        <button
          type="button"
          onClick={() => { if (running) stop(); else play(); }}
          aria-label={running ? "Stop the walk-through" : "Replay how this row was built"}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-divider bg-surface px-3 text-[13px] font-semibold transition-[border-color,transform] duration-150 hover:border-ink active:scale-[0.97]"
        >
          <PlayIcon />
          {running ? "Playing" : "Replay"}
        </button>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2.5 px-4 pt-4 sm:px-5">
        <span className="font-serif text-xl font-semibold">Jan</span>
        <span className="text-sm text-muted">Senior Data Engineer at Acme</span>
      </div>
      <div role="tablist" aria-label="Coverage examples" className="flex gap-1.5 overflow-x-auto px-4 pt-3 sm:px-5">
        {EXAMPLES.map((ex, i) => (
          <button
            key={ex.key}
            ref={(b) => { tabs.current[i] = b; }}
            type="button"
            role="tab"
            id={`ex-tab-${ex.key}`}
            aria-selected={i === sel}
            aria-controls={`ex-panel-${ex.key}`}
            tabIndex={i === sel ? 0 : -1}
            onClick={() => { choose(i, false); }}
            onKeyDown={(e) => { onKey(e, i); }}
            className={`min-h-10 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-150 ${i === sel ? "border-ink bg-ink text-white" : "border-divider bg-surface text-muted hover:border-line hover:text-ink"}`}
          >
            {ex.key}
          </button>
        ))}
      </div>
      <div className="grid px-4 pt-2 pb-4 sm:px-5">
        {EXAMPLES.map((ex, i) => (
          <div
            key={ex.key}
            role="tabpanel"
            id={`ex-panel-${ex.key}`}
            aria-labelledby={`ex-tab-${ex.key}`}
            inert={i !== sel}
            className={`[grid-area:1/1] transition-[opacity,filter] duration-200 ${i === sel ? "opacity-100" : "invisible opacity-0 blur-[2px]"}`}
          >
            <Steps ex={ex} phase={i === sel ? phase : 0} checking={i === sel && checking} />
          </div>
        ))}
      </div>
      <p className="border-t border-divider bg-canvas px-4 py-3 text-[13px] leading-snug text-muted sm:px-5">
        A fictional candidate. Your brief shows the same rows for the person you add, with real sources.
      </p>
    </div>
  );
}
