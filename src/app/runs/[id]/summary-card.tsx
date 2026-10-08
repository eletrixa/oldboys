/**
 * "In 30 seconds" card on top of the brief, with an optional "Read aloud" button.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/summary-card.tsx
 * Deps:    react, ./summary
 * Tested:  n/a (the sentences are tested in __tests__/summary.test.ts)
 *
 * Key responsibilities:
 * - SummaryCard: the three sentences from summary30s (documented, missing, ask); nothing while there is no brief
 * - ReadAloud: browser SpeechSynthesis only (no external service); hidden when the browser has none; toggles Stop
 *
 * Design constraints:
 * - Client only; support is read with useSyncExternalStore so the server render (no button) hydrates cleanly
 */
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { RunState } from "./state";
import { summary30s, summaryText } from "./summary";

const noop = (): void => undefined;
const subscribe = (): (() => void) => noop;
const hasSpeech = (): boolean => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const noSpeechOnServer = (): boolean => false;

function ReadAloud({ text }: { text: string }): React.JSX.Element | null {
  const supported = useSyncExternalStore(subscribe, hasSpeech, noSpeechOnServer);
  const [speaking, setSpeaking] = useState(false);
  // Stop speaking when the card unmounts (navigation, brief replaced).
  useEffect(() => () => {
    if (hasSpeech()) window.speechSynthesis.cancel();
  }, []);
  if (!supported) return null;

  const toggle = (): void => {
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.onend = () => {
      setSpeaking(false);
    };
    u.onerror = () => {
      setSpeaking(false);
    };
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  return (
    <button type="button" className="shrink-0 rounded-xl border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800" onClick={toggle} aria-pressed={speaking}>
      {speaking ? "Stop" : "Read aloud"}
    </button>
  );
}

export function SummaryCard({ state }: { state: RunState }): React.JSX.Element | null {
  const s = summary30s(state);
  if (s === null) return null;
  return (
    <section className="rounded-2xl border border-teal-800/60 bg-teal-950/20 p-5" aria-labelledby="summary-30s">
      <div className="flex items-start justify-between gap-3">
        <h2 id="summary-30s" className="font-semibold">
          In 30 seconds
        </h2>
        <ReadAloud text={summaryText(s)} />
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-300">
        <li>{s.documented}</li>
        <li>{s.missing}</li>
        <li>{s.ask}</li>
      </ul>
    </section>
  );
}
