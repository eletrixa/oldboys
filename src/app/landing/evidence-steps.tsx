/**
 * One hero example as a three-step thread: requirement, evidence (with an inline "Show evidence" disclosure), question.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/evidence-steps.tsx
 * Deps:    react, ../ui, ./evidence-data, ./evidence-example (Phase type)
 * Tested:  e2e/home.spec.ts
 *
 * Key responsibilities:
 * - Thread with three dots; during a walk-through the terracotta line grows step by step and the active step is tinted
 * - "Show evidence" mirrors the run page: quote from the source, "Open at the quote", retrieval date, "Confirmed: …",
 *   and the saved text around the quote with the match marked; for "none" it lists what was searched
 * - The disclosure closes with its own button or Esc and returns focus to the toggle
 *
 * Design constraints:
 * - Emphasis only: every word stays on screen in every phase; transitions are transform, colour and background-size
 */
"use client";

import { useId, useRef, useState } from "react";
import { KEY, Pill } from "../ui";
import { type Example, NOT_SEARCHED, SEARCHED } from "./evidence-data";
import type { Phase } from "./evidence-example";

const SCALE: Record<Phase, string> = { 0: "scale-y-100", 1: "scale-y-[0.12]", 2: "scale-y-[0.55]", 3: "scale-y-100" };

function Dot({ n, phase }: Readonly<{ n: number; phase: Phase }>): React.JSX.Element {
  const on = phase === 0 || n <= phase;
  return (
    <span aria-hidden="true" className={`relative z-10 grid size-7 place-items-center rounded-full text-[13px] font-bold transition-colors duration-200 ${on ? "bg-action text-white" : "bg-surface text-muted ring-[1.5px] ring-line ring-inset"}`}>
      {n}
    </span>
  );
}

function Body({ n, phase, children }: Readonly<{ n: number; phase: Phase; children: React.ReactNode }>): React.JSX.Element {
  return <div className={`-mx-3 -my-2 flex min-w-0 flex-col gap-2 rounded-xl px-3 py-2 transition-colors duration-300 ${phase === n ? "bg-sage/55" : "bg-transparent"}`}>{children}</div>;
}

export function Steps({ ex, phase, checking }: Readonly<{ ex: Example; phase: Phase; checking: boolean }>): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = (): void => { setOpen(false); toggle.current?.focus(); };
  const sweep = phase === 1 ? "0% 40%" : "100% 40%";
  const openLine = phase === 1 || phase === 2 ? "decoration-transparent" : "decoration-action/55";

  return (
    <div className="relative">
      <span aria-hidden="true" className="absolute top-6 bottom-12 left-[13px] w-0.5 rounded bg-divider" />
      <span aria-hidden="true" className={`absolute top-6 bottom-12 left-[13px] w-0.5 origin-top rounded bg-action transition-transform duration-[900ms] ease-[cubic-bezier(.77,0,.175,1)] ${SCALE[phase]}`} />
      <ol className="flex flex-col">
        <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-3.5 py-3">
          <Dot n={1} phase={phase} />
          <Body n={1} phase={phase}>
            <span className={KEY}>Requirement</span>
            <span className="text-[17px] leading-snug font-semibold">{ex.requirement}</span>
            {ex.claim !== null ? (
              <span className="flex items-start gap-2 text-sm"><Pill tone={ex.claim.kind === "FACT" ? "neutral" : "inference"} className="mt-0.5">{ex.claim.kind}</Pill>{ex.claim.text}</span>
            ) : (
              <span className="text-sm text-muted">No claim yet: nothing public to quote.</span>
            )}
          </Body>
        </li>
        <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-3.5 py-3">
          <Dot n={2} phase={phase} />
          <Body n={2} phase={phase}>
            <span className={KEY}>Evidence</span>
            {ex.quote !== null && ex.source !== null ? (
              <>
                <p className="font-serif text-[18px] leading-[1.45]">
                  <span className="bg-[linear-gradient(rgba(164,71,50,.17),rgba(164,71,50,.17))] bg-no-repeat [background-position:0_90%] box-decoration-clone transition-[background-size] duration-700 ease-[cubic-bezier(.23,1,.32,1)]" style={{ backgroundSize: sweep }}>
                    “{ex.quote}”
                  </span>
                </p>
                <span className="text-[13px] text-muted">{ex.source.host} · read {ex.source.read}</span>
              </>
            ) : (
              <p className="text-[15px] leading-snug">No public source found for this requirement.</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {checking ? <Pill tone="neutral">checking the source</Pill> : <Pill tone={ex.tone}>{ex.key}</Pill>}
              <span className="text-sm text-muted">
                {ex.why.lead}
                <span className={`underline decoration-2 underline-offset-4 transition-[text-decoration-color] duration-300 ${openLine}`}>{ex.why.open}</span>
              </span>
            </div>
            <button
              ref={toggle}
              type="button"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => { setOpen((o) => !o); }}
              onKeyDown={(e) => { if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); } }}
              className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-lg border border-divider bg-surface px-3 text-sm font-semibold text-action transition-[border-color,background-color,transform] duration-150 hover:border-action active:scale-[0.97]"
            >
              <span aria-hidden="true" className={`inline-block transition-transform duration-200 ${open ? "rotate-90" : ""}`}>›</span>
              {ex.source !== null ? (open ? "Hide evidence" : "Show evidence") : open ? "Hide what was searched" : "What was searched"}
            </button>
            <div
              id={id}
              hidden={!open}
              onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}
              className="flex flex-col gap-2 rounded-xl border border-divider bg-surface p-3 text-sm"
            >
              {ex.source !== null && ex.quote !== null ? (
                <>
                  <span className={KEY}>Quote from the source</span>
                  <p className="text-muted">
                    <span className="font-semibold text-action">Open at the quote</span> · {ex.source.host} · retrieved {ex.source.read} · Confirmed: {ex.source.confirmed}
                  </p>
                  <p className="rounded-lg bg-canvas p-2.5 leading-relaxed">
                    {ex.source.before}<mark className="rounded-sm bg-peach px-0.5 text-ink">{ex.quote}</mark>{ex.source.after}
                  </p>
                  <span className="text-[13px] text-muted">Saved text, kept until {ex.source.kept}. In the app, “Open at the quote” opens the page scrolled to it.</span>
                </>
              ) : (
                <>
                  <p><span className="font-semibold">Searched:</span> {SEARCHED}.</p>
                  <p><span className="font-semibold">Not searched:</span> {NOT_SEARCHED}</p>
                </>
              )}
              <button type="button" onClick={close} className="min-h-10 w-fit rounded-lg px-2 text-sm font-semibold text-muted hover:bg-sage/60 hover:text-ink">Close</button>
            </div>
          </Body>
        </li>
        <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-3.5 py-3">
          <Dot n={3} phase={phase} />
          <Body n={3} phase={phase}>
            <span className={KEY}>Question to ask</span>
            <p className="font-serif text-[18px] leading-[1.45]">“{ex.question}”</p>
            <span className="text-[13px] text-muted">{ex.from}</span>
          </Body>
        </li>
      </ol>
    </div>
  );
}
