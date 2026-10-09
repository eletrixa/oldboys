/**
 * "In 30 seconds" card on top of the brief, with an optional "Read aloud" button.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/summary-card.tsx
 * Deps:    react, ./summary, ./report-text (splitLead, tid), ./report-lang (useReport), ../../ui (Radar primitives)
 * Tested:  n/a (the sentences are tested in __tests__/summary.test.ts)
 *
 * Key responsibilities:
 * - SummaryCard: the three sentences from summary30s (documented, missing, ask), each lead word (Confirmed, Missing,
 *   Ask) coloured; nothing while there is no brief
 * - ReadAloud: browser SpeechSynthesis only (no external service); hidden when the browser has none; toggles Stop;
 *   reads in the report's language (cs-CZ for the Czech brief)
 * - Czech brief (idea #24): lead words and headings from the dictionary, each sentence body translated by id
 *
 * Design constraints:
 * - Client only; support is read with useSyncExternalStore so the server render (no button) hydrates cleanly
 */
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BTN_QUIET, CARD, Eyebrow } from "../../ui";
import { useReport } from "./report-lang";
import { splitLead, tid } from "./report-text";
import type { RunState } from "./state";
import { type Summary30s, summary30s } from "./summary";

const noop = (): void => undefined;
const subscribe = (): (() => void) => noop;
const hasSpeech = (): boolean => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const noSpeechOnServer = (): boolean => false;

function ReadAloud({ text }: { text: string }): React.JSX.Element | null {
  const { t } = useReport();
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
    u.lang = t.speechLang;
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
      {speaking ? t.stopReading : t.readAloud}
    </button>
  );
}

const TONE: Record<keyof Summary30s, string> = { documented: "text-ok", missing: "text-unsure", ask: "text-action" };
const PARTS = ["documented", "missing", "ask"] as const;

/** One sentence in the report language: its lead word ("Confirmed", "Ask" …) in its tone colour, then the body. */
function sentenceOf(s: Summary30s, part: keyof Summary30s, report: ReturnType<typeof useReport>): { lead: string | null; body: string } {
  const { lead, body } = splitLead(s[part]);
  return { lead: lead === null ? null : report.t.lead[lead], body: report.text(tid.summary(part), body) };
}

function Row({ lead, tone, body }: { lead: string | null; tone: string; body: string }): React.JSX.Element {
  if (lead === null) return <li className="py-1.5">{body}</li>;
  return (
    <li className="py-1.5">
      <span className={`font-semibold ${tone}`}>{lead}</span>: {body}
    </li>
  );
}

export function SummaryCard({ state }: { state: RunState }): React.JSX.Element | null {
  const report = useReport();
  const s = summary30s(state);
  if (s === null) return null;
  const rows = PARTS.map((part) => ({ part, ...sentenceOf(s, part, report) }));
  return (
    <section className={`${CARD} border-l-4 border-l-action`} aria-labelledby="summary-30s">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>{report.t.summaryEyebrow}</Eyebrow>
          <h2 id="summary-30s" className="mt-1 font-serif text-2xl">
            {report.t.summaryTitle}
          </h2>
        </div>
        <ReadAloud text={rows.map((r) => (r.lead === null ? r.body : `${r.lead}: ${r.body}`)).join(" ")} />
      </div>
      <ul className="mt-3 divide-y divide-divider text-sm text-ink">
        {rows.map((r) => (
          <Row key={r.part} lead={r.lead} tone={TONE[r.part]} body={r.body} />
        ))}
      </ul>
    </section>
  );
}
