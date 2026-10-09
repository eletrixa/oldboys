/**
 * "In 30 seconds" card on top of the brief, with an optional "Read aloud" button.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/summary-card.tsx
 * Deps:    react, src/domain/call (type), ./summary, ./summary-cs (summaryLines), ./brief-layout, ./brief-tabs (useNav), ./report-lang (useReport), ./report-text (tid), ../../ui (Radar primitives), POST /api/runs/:id/speech
 * Tested:  n/a (the sentences are tested in __tests__/summary.test.ts and __tests__/summary-cs.test.ts)
 *
 * Key responsibilities:
 * - SummaryCard: three numbers (role criteria with public evidence + the criteria with a coverage dot; phone screen
 *   answered of asked + open answers; facts / inferences / gaps found), each with a link that opens its tab; the three
 *   sentences from summary30s (documented, missing, ask) stay as the read-aloud text and under "In sentences"
 * - ReadAloud: the call agent's ElevenLabs voice via POST /api/runs/:id/speech (MP3, signed-in users); on any error
 *   browser SpeechSynthesis with a natural voice (macOS novelty voices skipped); toggles Stop; reads in the report's
 *   language (Czech for the Czech brief)
 * - Czech brief (idea #24): lines from summaryLines (built from counts and translated criteria, never a translated
 *   sentence), lead words and headings from the dictionary
 *
 * Design constraints:
 * - Client only; the button always renders (audio works everywhere), the browser voice is only the fallback
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { CallAnswer } from "@/domain/call";
import { BTN_QUIET, CARD, Chevron, Eyebrow, KEY, LINK, SUMMARY } from "../../ui";
import { backgroundCounts, phoneNumbers } from "./brief-layout";
import { useNav } from "./brief-tabs";
import { tid } from "./report-text";
import { useReport } from "./report-lang";
import type { RunState } from "./state";
import { type Summary30s, aiOff, criteriaCounts, criteriaRows } from "./summary";
import { lineText, summaryLines } from "./summary-cs";

/** macOS novelty voices that Chrome may pick first for a bare `lang`; never used for the fallback. */
const NOVELTY =
  /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Zarvox|Fred|Junior|Ralph|Kathy|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/;
const PREFERRED = /Google|Samantha|Microsoft|Zuzana|Daniel|Karen|Moira|Ava|Allison|Tom/;

/** A natural voice for the language: a known good one, then any non-novelty one; undefined = browser default. */
function pickVoice(speechLang: string): SpeechSynthesisVoice | undefined {
  const prefix = speechLang.slice(0, 2).toLowerCase();
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(prefix) && !NOVELTY.test(v.name));
  return voices.find((v) => PREFERRED.test(v.name)) ?? voices[0];
}

const hasSpeech = (): boolean => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

/**
 * Reads the sentences in the call agent's ElevenLabs voice (POST /api/runs/:id/speech, signed-in users); when that
 * answers an error (logged out, no key, quota) it falls back to the browser voice with a natural voice picked.
 */
function ReadAloud({ runId, text }: { runId: string; text: string }): React.JSX.Element {
  const { t, lang } = useReport();
  const [speaking, setSpeaking] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const abort = useRef<AbortController | null>(null);

  const release = (): void => {
    abort.current?.abort();
    abort.current = null;
    if (audio.current !== null) {
      audio.current.pause();
      URL.revokeObjectURL(audio.current.src);
      audio.current = null;
    }
    if (hasSpeech()) window.speechSynthesis.cancel();
  };
  // Stop speaking when the card unmounts (navigation, brief replaced).
  useEffect(() => release, []);

  const browserVoice = (): void => {
    if (!hasSpeech()) {
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = t.speechLang;
    const voice = pickVoice(t.speechLang);
    if (voice !== undefined) u.voice = voice;
    u.onend = () => {
      setSpeaking(false);
    };
    u.onerror = () => {
      setSpeaking(false);
    };
    window.speechSynthesis.speak(u);
  };

  const play = async (): Promise<void> => {
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`speech ${String(res.status)}`);
      const el = new Audio(URL.createObjectURL(await res.blob()));
      audio.current = el;
      const done = (): void => {
        release();
        setSpeaking(false);
      };
      el.onended = done;
      el.onerror = done;
      await el.play();
    } catch (err) {
      if (controller.signal.aborted) return;
      console.warn("read aloud: ElevenLabs voice unavailable, using the browser voice", err);
      browserVoice();
    }
  };

  const toggle = (): void => {
    release();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    void play();
  };

  return (
    <button type="button" className={`${BTN_QUIET} shrink-0 print:hidden`} onClick={toggle} aria-pressed={speaking}>
      {speaking ? t.stopReading : t.readAloud}
    </button>
  );
}

const TONE: Record<keyof Summary30s, string> = { documented: "text-ok", missing: "text-unsure", ask: "text-action" };
const PARTS = ["documented", "missing", "ask"] as const;

function Row({ lead, tone, body }: { lead: string | null; tone: string; body: string }): React.JSX.Element {
  if (lead === null) return <li className="py-1.5">{body}</li>;
  return (
    <li className="py-1.5">
      <span className={`font-semibold ${tone}`}>{lead}</span>: {body}
    </li>
  );
}

/** A small dot for a coverage state: evidenced = ok, partial or none = unsure. */
function Dot({ ok }: { ok: boolean }): React.JSX.Element {
  return <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${ok ? "bg-ok" : "bg-unsure"}`} />;
}

function Big({ n, rest }: { n: number; rest: string }): React.JSX.Element {
  return (
    <p className="font-serif text-4xl leading-none tabular-nums">
      {n} <span className="text-2xl text-muted">{rest}</span>
    </p>
  );
}

const COL = "flex min-w-0 flex-col gap-3 md:px-6 md:first:pl-0 md:last:pr-0";
const GO = `${LINK} w-fit text-sm`;

/**
 * The three numbers: role criteria with public evidence, the phone screen, the background found. `answers` is the newest
 * read call (null = no call yet); `callDay` its date. Counts describe the research, never the person.
 */
export function SummaryCard({ state, answers, callDay }: { state: RunState; answers: readonly CallAnswer[] | null; callDay: string }): React.JSX.Element | null {
  const report = useReport();
  const { ui } = report.t;
  const nav = useNav();
  const lines = summaryLines(state, report);
  const brief = state.brief;
  if (lines === null || brief === null) return null;
  // Each lead word ("Confirmed", "Ask" …) in its tone colour, then the body.
  const rows = PARTS.map((part) => ({ part, ...lines[part] }));
  const counts = criteriaCounts(brief);
  const off = aiOff(brief);
  const byId = new Map(state.questions.map((q) => [q.id, q]));
  const criteria = criteriaRows(brief).rows;
  const open = criteria.filter((c) => c.coverage !== "evidenced" && c.question_id.startsWith("mh-")).length;
  const phone = phoneNumbers(answers);
  const bg = backgroundCounts(state.claims, brief);
  return (
    <section className={`${CARD} flex flex-col gap-5 border-l-4 border-l-action`} aria-labelledby="summary-30s">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>{report.t.summaryEyebrow}</Eyebrow>
          <h2 id="summary-30s" className="mt-1 font-serif text-2xl">
            {report.t.summaryTitle}
          </h2>
        </div>
        <ReadAloud runId={state.id} text={rows.map(lineText).join(" ")} />
      </div>
      <div className="grid gap-6 md:grid-cols-3 md:gap-0 md:divide-x md:divide-divider">
        <div className={COL}>
          <p className={KEY}>{ui.criteriaKey(counts.noun === "research questions")}</p>
          {off ? (
            <p className="text-sm text-muted">{ui.criteriaOff}</p>
          ) : (
            <>
              <Big n={counts.evidenced} rest={ui.ofN(counts.total)} />
              <ul className="flex flex-col gap-1.5 text-sm">
                {criteria.map((c) => {
                  const q = byId.get(c.question_id);
                  return (
                    <li key={c.question_id} className="flex items-start gap-2">
                      <Dot ok={c.coverage === "evidenced"} />
                      <span className="min-w-0">{q?.title ?? report.text(tid.question(c.question_id), q?.text ?? c.question_id)}</span>
                    </li>
                  );
                })}
              </ul>
              {open > 0 && <p className="text-xs text-muted">{ui.criteriaInPlan(open)}</p>}
            </>
          )}
        </div>
        <div className={COL}>
          <p className={KEY}>{callDay === "" ? ui.phoneKey : `${ui.phoneKey} · ${callDay}`}</p>
          {phone === null ? (
            <>
              <p className="font-serif text-2xl leading-tight text-muted">{ui.noCall}</p>
              <p className="text-sm text-muted">{ui.noCallHint}</p>
              <button type="button" className={GO} onClick={() => { nav.openTab("call"); }}>{ui.setUpCall}</button>
            </>
          ) : (
            <>
              <Big n={phone.answered} rest={ui.answeredOf(phone.asked)} />
              <ul className="flex flex-col gap-1.5 text-sm">
                {phone.noAnswer > 0 && <li className="flex items-start gap-2"><Dot ok={false} />{ui.noAnswerCount(phone.noAnswer)}</li>}
                {phone.open - phone.noAnswer > 0 && <li className="flex items-start gap-2"><Dot ok={false} />{ui.unclearCount(phone.open - phone.noAnswer)}</li>}
                <li className="text-xs text-muted">{ui.saidByCandidate}</li>
              </ul>
              <button type="button" className={GO} onClick={() => { nav.openTab("call"); }}>{ui.seeAnswers}</button>
            </>
          )}
        </div>
        <div className={COL}>
          <p className={KEY}>{ui.backgroundKey}</p>
          <Big n={bg.facts} rest={ui.facts(bg.facts)} />
          <ul className="flex flex-col gap-1.5 text-sm">
            {bg.inferences > 0 && <li className="flex items-start gap-2"><Dot ok={false} />{ui.inferencesToVerify(bg.inferences)}</li>}
            {bg.gaps > 0 && <li className="flex items-start gap-2"><Dot ok={false} />{ui.gapsCount(bg.gaps)}</li>}
          </ul>
          <button type="button" className={GO} onClick={() => { nav.openTab("evidence"); }}>{ui.seeEvidence}</button>
        </div>
      </div>
      <details className="group border-t border-divider pt-2">
        <summary className={SUMMARY}>
          <Chevron />
          {ui.sentences}
        </summary>
        <ul className="divide-y divide-divider text-sm text-ink">
          {rows.map((r) => (
            <Row key={r.part} lead={r.lead} tone={TONE[r.part]} body={r.body} />
          ))}
        </ul>
      </details>
    </section>
  );
}
