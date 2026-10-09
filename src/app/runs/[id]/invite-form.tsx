/**
 * "Add interview to calendar (.ics)": date, time and duration, then a download of the invite with the brief inside (idea #22).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/invite-form.tsx
 * Deps:    react, ../../ui (Radar tokens), ./state (types), ./interview-invite, ./i18n (Report), ./report-lang (useReport)
 * Tested:  n/a (the invite text is tested in __tests__/interview-invite.test.ts)
 *
 * Key responsibilities:
 * - InviteForm: disclosure with labelled date, time (local, default next working day 10:00) and duration (30/45/60/90,
 *   default 60) fields and a "Download .ics" button that builds the invite at click time with this page as the brief link
 * - `asButton` + `id`: the kit card's "Add interview to calendar" secondary button; the phone bar opens it by id
 * - The form's labels follow the page's report language (`useReport().t.kit`); the invite is in the report language (`language`, idea #24 follow-up); a Czech one downloads as interview-<id>-cs.ics
 *
 * Design constraints:
 * - Client only; no fetch, no storage; the recruiter imports the file and adds the interviewers in the calendar
 */
"use client";

import { useId, useState } from "react";
import { BTN_SECONDARY, Chevron, FIELD, SUMMARY } from "../../ui";
import type { RunState } from "./state";
import { interviewInvite, inviteFileName } from "./interview-invite";
import type { Report } from "./i18n";
import { useReport } from "./report-lang";

const DURATIONS = [30, 45, 60, 90] as const;

const pad = (n: number): string => String(n).padStart(2, "0");

/** The next Monday-to-Friday after today, as a local YYYY-MM-DD for the date input. */
function nextWorkingDay(today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local date + time inputs as a Date, or null when either does not parse. */
function localStart(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})/.exec(time);
  if (d === null || t === null) return null;
  const start = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  return Number.isNaN(start.getTime()) ? null : start;
}

function downloadIcs(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
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

/** `asButton`: the summary reads as a secondary button ("Add interview to calendar"), for the kit card in the sidebar. */
export function InviteForm({ state, language, id: anchor, asButton = false }: { state: RunState; language: Report; id?: string; asButton?: boolean }): React.JSX.Element {
  const [date, setDate] = useState(() => nextWorkingDay(new Date()));
  const [time, setTime] = useState("10:00");
  const [minutes, setMinutes] = useState<number>(60);
  const id = useId();
  const start = localStart(date, time);
  const t = useReport().t.kit;

  const download = (): void => {
    if (start === null) return;
    const text = interviewInvite(state, { start, minutes, briefUrl: `${window.location.origin}/runs/${state.id}`, now: new Date() }, language);
    if (text !== null) downloadIcs(text, inviteFileName(state, language.lang));
  };

  return (
    <details className="group" id={anchor}>
      <summary className={asButton ? `${BTN_SECONDARY} w-full cursor-pointer list-none [&::-webkit-details-marker]:hidden` : SUMMARY}>
        <Chevron />
        {t.addToCalendar}{asButton ? "" : t.ics}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-date`} className="text-sm font-medium text-ink">
              {t.date}
            </label>
            <input
              id={`${id}-date`}
              type="date"
              className={`${FIELD} w-auto py-2`}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-time`} className="text-sm font-medium text-ink">
              {t.time}
            </label>
            <input
              id={`${id}-time`}
              type="time"
              className={`${FIELD} w-auto py-2`}
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-minutes`} className="text-sm font-medium text-ink">
              {t.duration}
            </label>
            <select
              id={`${id}-minutes`}
              className={`${FIELD} w-auto py-2`}
              value={minutes}
              onChange={(e) => {
                setMinutes(Number(e.target.value));
              }}
            >
              {DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {String(m)} min
                </option>
              ))}
            </select>
          </div>
          <button type="button" className={BTN_SECONDARY} disabled={start === null} onClick={download}>
            {t.downloadIcs}
          </button>
        </div>
        <p className="text-xs text-muted">{t.icsHint}</p>
      </div>
    </details>
  );
}
