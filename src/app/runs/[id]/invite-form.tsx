/**
 * "Add interview to calendar (.ics)": date, time and duration, then a download of the invite with the brief inside (idea #22).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/invite-form.tsx
 * Deps:    react, ../../ui (Radar tokens), ./state (types), ./interview-invite
 * Tested:  n/a (the invite text is tested in __tests__/interview-invite.test.ts)
 *
 * Key responsibilities:
 * - InviteForm: disclosure with labelled date, time (local, default next working day 10:00) and duration (30/45/60/90,
 *   default 60) fields and a "Download .ics" button that builds the invite at click time with this page as the brief link
 *
 * Design constraints:
 * - Client only; no fetch, no storage; the recruiter imports the file and adds the interviewers in the calendar
 */
"use client";

import { useId, useState } from "react";
import { BTN_SECONDARY, Chevron, FIELD, SUMMARY } from "../../ui";
import type { RunState } from "./state";
import { interviewInvite, inviteFileName } from "./interview-invite";

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

export function InviteForm({ state }: { state: RunState }): React.JSX.Element {
  const [date, setDate] = useState(() => nextWorkingDay(new Date()));
  const [time, setTime] = useState("10:00");
  const [minutes, setMinutes] = useState<number>(60);
  const id = useId();
  const start = localStart(date, time);

  const download = (): void => {
    if (start === null) return;
    const text = interviewInvite(state, { start, minutes, briefUrl: `${window.location.origin}/runs/${state.id}`, now: new Date() });
    if (text !== null) downloadIcs(text, inviteFileName(state));
  };

  return (
    <details className="group">
      <summary className={SUMMARY}>
        <Chevron />
        Add interview to calendar (.ics)
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-date`} className="text-sm font-medium text-ink">
              Date
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
              Time (your local time)
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
              Duration
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
            Download .ics
          </button>
        </div>
        <p className="text-xs text-muted">
          Import it into Google Calendar or Outlook and add the interviewers there. The invite carries the summary, the interview
          questions and a link to this brief.
        </p>
      </div>
    </details>
  );
}
