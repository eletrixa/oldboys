/**
 * Pure helpers for the intake queue: status and source labels, row shaping, dates, the run-page "From ..." line.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/intake/intake-rows.ts
 * Deps:    src/domain/application, src/domain/claim (types only)
 * Tested:  src/app/intake/__tests__/intake-rows.test.ts
 *
 * Key responsibilities:
 * - ApplicationListRow: the GET /api/intake/applications row (snake_case, only the rendered columns); TagRow: the GET /api/intake/tags row
 * - STATUS_LABEL / STATUS_TONE / SOURCE_LABEL: plain words and a colour tone per enum value (exhaustive records, exported)
 * - formatReceived: UTC "YYYY-MM-DD HH:MM", identical on server and client (no hydration drift)
 * - shapeRow: the display row (run link only with a run id, truncated note plus the full text for the title)
 * - intakeLine: "From <source> · <tag> · <date>" shown under the run heading
 *
 * Design constraints:
 * - Pure: no React, no fetch, no clock; imported by the route, the views and the run page
 * - No ranking, no score: the queue is a list in arrival order
 */
import type { ApplicationSource, ApplicationStatus } from "@/domain/application";
import type { GoalId } from "@/domain/claim";

/** Longest note shown in the table cell; the full note sits in the cell's title. */
const NOTE_MAX = 80;

export type ApplicationListRow = {
  id: string;
  source: ApplicationSource;
  tag: string | null;
  name: string | null;
  email: string | null;
  status: ApplicationStatus;
  run_id: string | null;
  note: string | null;
  received_at: string;
};

/** One intake_tags row as GET /api/intake/tags returns it. */
export type TagRow = { tag: string; role: string; goal: GoalId; company: string | null; startupjobs_offer_id: string | null; created_at: string };

export type StatusTone = "ok" | "unsure" | "conflict" | "neutral";

export const STATUS_LABEL: Readonly<Record<ApplicationStatus, string>> = {
  received: "Received",
  "run-started": "Run started",
  unmatched: "Unmatched",
  incomplete: "Incomplete",
  capped: "Held back (hourly cap)",
};

export const STATUS_TONE: Readonly<Record<ApplicationStatus, StatusTone>> = {
  received: "neutral",
  "run-started": "ok",
  unmatched: "conflict",
  incomplete: "unsure",
  capped: "unsure",
};

export const SOURCE_LABEL: Readonly<Record<ApplicationSource, string>> = {
  email: "Email",
  form: "Google Form",
  "apply-page": "Apply page",
  startupjobs: "StartupJobs",
};

/** "2026-10-09 14:05" in UTC; the raw string when it does not parse. */
export function formatReceived(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? iso : new Date(ms).toISOString().slice(0, 16).replace("T", " ");
}

export type IntakeRow = {
  id: string;
  received: string;
  tag: string | null;
  source: string;
  name: string;
  email: string | null;
  status: string;
  tone: StatusTone;
  runHref: string | null;
  note: string | null;
  noteFull: string | null;
};

export function shapeRow(row: ApplicationListRow): IntakeRow {
  const note = row.note;
  return {
    id: row.id,
    received: formatReceived(row.received_at),
    tag: row.tag,
    source: SOURCE_LABEL[row.source],
    name: row.name ?? "(no name)",
    email: row.email,
    status: STATUS_LABEL[row.status],
    tone: STATUS_TONE[row.status],
    runHref: row.run_id === null ? null : `/runs/${row.run_id}`,
    note: note !== null && note.length > NOTE_MAX ? `${note.slice(0, NOTE_MAX)}…` : note,
    noteFull: note,
  };
}

/** What `GET /api/runs/:id/state` returns as `intake` for a run an application started. */
export type RunIntake = { source: ApplicationSource; tag: string | null; receivedAt: string };

/** "From Email · senior-be · 2026-10-09"; the tag is left out when the application had none. */
export function intakeLine(intake: RunIntake): string {
  const date = formatReceived(intake.receivedAt).slice(0, 10);
  return [`From ${SOURCE_LABEL[intake.source]}`, ...(intake.tag === null ? [] : [intake.tag]), date].join(" · ");
}
