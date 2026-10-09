/**
 * Report language on the run page (idea #24): the "EN | CZ" switch, the remembered choice and the on-demand translation.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/report-lang.tsx
 * Deps:    react, next/link, src/app/login/next-path, ../../ui (Radar tokens), ./i18n
 * Tested:  n/a (the dictionary in __tests__/i18n.test.ts, the route in src/app/api/runs/[id]/translate/__tests__/handler.test.ts)
 *
 * Key responsibilities:
 * - ReportContext / useReport: the Report (labels + translated text per id) every brief component reads; English by default
 * - useReportLanguage: the viewer's choice in localStorage (try/catch, memory fallback), and for CZ one
 *   POST /api/runs/:id/translate per page view (the server caches it per brief); the brief stays English until the
 *   translation arrives and whenever it fails
 * - exports: a Report in the chosen language with the translated texts once loaded, so the exports follow the switch
 *   at once and never wait for the translation (Czech fixed lines with English texts before it arrives or on failure)
 * - LangSwitch: "EN | CZ" (aria-pressed, 44px targets, same look as the candidate notice switch), "Překládám…",
 *   errors in plain words with a retry, a login link on 401, and the "quotes stay in the original" note; a partial
 *   translation (some batches failed, `partial: true`) is shown with a plain line and the same retry
 *
 * Design constraints:
 * - Client only; nothing is sent but the run id and the language
 * - No setState synchronously inside an effect: loading is derived (chosen CZ, no result for this attempt yet)
 */
"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { loginHref } from "@/app/login/next-path";
import { BTN_QUIET, LINK } from "../../ui";
import { ENGLISH_REPORT, REPORT_DICT, type Report, type ReportLang, makeReport } from "./i18n";

export const ReportContext = createContext<Report>(ENGLISH_REPORT);

export function useReport(): Report {
  return useContext(ReportContext);
}

/** Same look as the candidate notice switch: 44px targets, the pressed one in ink and semibold. */
export const LANG_BTN = `${BTN_QUIET} min-h-11 px-3 aria-pressed:font-semibold aria-pressed:text-ink`;

const LANG_KEY = "oldboys.reportLang";
const LANG_EVENT = "oldboys:report-lang";
/** Used when localStorage is blocked, so the switch still works for this page view. */
let memoryLang: ReportLang = "en";

function readLang(): ReportLang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    return stored === "cs" || stored === "en" ? stored : memoryLang;
  } catch {
    return memoryLang;
  }
}

function storeLang(lang: ReportLang): void {
  memoryLang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Storage blocked: remembered for this page view only.
  }
  window.dispatchEvent(new Event(LANG_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(LANG_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LANG_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const englishOnServer = (): ReportLang => "en";

type Outcome =
  | { kind: "ready"; texts: Record<string, string>; partial: boolean }
  | { kind: "login" }
  | { kind: "error"; message: string; retry: boolean };

/** Plain Czech words per refusal; the English brief stays on the page in every case. */
function failure(status: number): Outcome {
  if (status === 402) return { kind: "error", message: "Podklad je na překlad příliš dlouhý (limit nákladů). Zůstává v angličtině.", retry: false };
  if (status === 409) return { kind: "error", message: "Podklad ještě není hotový. Přeložit půjde, až bude.", retry: true };
  if (status === 503) return { kind: "error", message: "Překlad teď není k dispozici. Podklad zůstává v angličtině.", retry: false };
  return { kind: "error", message: "Překlad se nepodařil. Podklad zůstává v angličtině.", retry: true };
}

async function fetchTranslation(runId: string): Promise<Outcome> {
  try {
    const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: "cs" }),
    });
    if (res.status === 401) return { kind: "login" };
    if (!res.ok) return failure(res.status);
    const body = await res.json<{ texts?: Record<string, string>; partial?: boolean }>();
    return { kind: "ready", texts: body.texts ?? {}, partial: body.partial === true };
  } catch {
    return failure(0);
  }
}

export type ReportLanguage = {
  chosen: ReportLang;
  choose: (lang: ReportLang) => void;
  report: Report;
  /** What the exports are built in: the chosen language, translated texts once they are here. */
  exports: Report;
  loading: boolean;
  outcome: Outcome | null;
  retry: () => void;
};

export function useReportLanguage(runId: string): ReportLanguage {
  const chosen = useSyncExternalStore(subscribe, readLang, englishOnServer);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; outcome: Outcome } | null>(null);
  const done = result?.attempt === attempt;

  useEffect(() => {
    if (chosen !== "cs" || done) return;
    let cancelled = false;
    void fetchTranslation(runId).then((outcome) => {
      if (!cancelled) setResult({ attempt, outcome });
    });
    return () => {
      cancelled = true;
    };
  }, [chosen, done, runId, attempt]);

  const outcome = chosen === "cs" && result !== null && result.attempt === attempt ? result.outcome : null;
  const texts = outcome?.kind === "ready" ? outcome.texts : null;
  const report = texts !== null ? makeReport("cs", texts) : ENGLISH_REPORT;
  return {
    chosen,
    choose: storeLang,
    report,
    exports: makeReport(chosen, texts),
    loading: chosen === "cs" && !done,
    outcome,
    retry: () => {
      setAttempt((a) => a + 1);
    },
  };
}

const LANGS: readonly { lang: ReportLang; label: string; title: string }[] = [
  { lang: "en", label: "EN", title: "Brief in English" },
  { lang: "cs", label: "CZ", title: "Podklad v češtině" },
];

const PARTIAL_MESSAGE = "Část podkladu se nepodařilo přeložit, zbytek zůstává v angličtině.";

function Status({ runId, language }: { runId: string; language: ReportLanguage }): React.JSX.Element | null {
  const { outcome } = language;
  if (language.loading) return <span className="text-xs text-muted">{REPORT_DICT.cs.translating}</span>;
  if (outcome === null) return null;
  if (outcome.kind === "ready" && !outcome.partial) return <span className="text-xs text-muted">{REPORT_DICT.cs.quotesNote}</span>;
  if (outcome.kind === "login") {
    return (
      <span className="text-xs text-conflict">
        Pro překlad se znovu přihlaste.{" "}
        <Link href={loginHref(`/runs/${runId}`)} className={LINK}>Přihlásit se</Link>
      </span>
    );
  }
  const message = outcome.kind === "ready" ? PARTIAL_MESSAGE : outcome.message;
  const retry = outcome.kind === "ready" || outcome.retry;
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-xs text-conflict">
      {message}
      {retry && (
        <button type="button" className={`${BTN_QUIET} min-h-11`} onClick={language.retry}>
          Zkusit znovu
        </button>
      )}
    </span>
  );
}

/** "EN | CZ" at the top of the brief, with what the translation is doing next to it. */
export function LangSwitch({ runId, language }: { runId: string; language: ReportLanguage }): React.JSX.Element {
  const t = REPORT_DICT[language.chosen];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" lang={language.chosen}>
      <div className="flex gap-1" role="group" aria-label={t.switchGroup}>
        {LANGS.map((l) => (
          <button
            key={l.lang}
            type="button"
            className={LANG_BTN}
            aria-pressed={language.chosen === l.lang}
            title={l.title}
            onClick={() => { language.choose(l.lang); }}
          >
            {l.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted">{t.switchGroup}</span>
      <span role="status" className="min-w-0">
        <Status runId={runId} language={language} />
      </span>
    </div>
  );
}
