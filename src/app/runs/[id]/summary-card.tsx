/**
 * "In 30 seconds" card on top of the brief, with an optional "Read aloud" button.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/summary-card.tsx
 * Deps:    react, ./summary, ../../ui (Radar primitives)
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
import { BTN_QUIET, CARD, Eyebrow } from "../../ui";
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
    <button type="button" className={`${BTN_QUIET} shrink-0`} onClick={toggle} aria-pressed={speaking}>
      {speaking ? "Stop" : "Read aloud"}
    </button>
  );
}

export function SummaryCard({ state }: { state: RunState }): React.JSX.Element | null {
  const s = summary30s(state);
  if (s === null) return null;
  return (
    <section className={`${CARD} border-l-4 border-l-action`} aria-labelledby="summary-30s">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Summary</Eyebrow>
          <h2 id="summary-30s" className="mt-1 font-serif text-2xl">
            In 30 seconds
          </h2>
        </div>
        <ReadAloud text={summaryText(s)} />
      </div>
      <ul className="mt-3 divide-y divide-divider text-sm text-ink">
        <li className="py-1.5">{s.documented}</li>
        <li className="py-1.5">{s.missing}</li>
        <li className="py-1.5">{s.ask}</li>
      </ul>
    </section>
  );
}
