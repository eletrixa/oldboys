/**
 * Run tray state: which runs this browser tab is watching, and the pure projection of a run state into a tray row.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/run-tray-store.ts
 * Deps:    src/app/runs/[id]/state (RunState, stepRows, firstName)
 * Tested:  src/app/_components/__tests__/run-tray-store.test.ts
 *
 * Key responsibilities:
 * - `trackRun` / `untrackRun` / `readTray`: a sessionStorage list of run ids (newest first, at most TRAY_MAX), and a
 *   window event (TRAY_EVENT) so the tray re-reads it without a reload
 * - `addRun` / `dropRun`: the pure list operations behind them
 * - `trayRow`: name, status label and tone, progress (0..1) and the five step dots for one run state
 * - `isLive`: whether a run still needs polling
 *
 * Design constraints:
 * - Storage may be blocked: reads give [], writes are ignored (same stance as token.ts)
 * - Pure helpers take and return arrays; only the three storage functions touch the browser
 */
import { firstName, type RunState, type RowState, stepRows } from "@/app/runs/[id]/state";
import type { Tone } from "@/app/ui";

export const TRAY_KEY = "oldboys.tray";
export const TRAY_EVENT = "oldboys:tray";
export const TRAY_MAX = 8;

export function addRun(ids: readonly string[], id: string): string[] {
  return [id, ...ids.filter((x) => x !== id)].slice(0, TRAY_MAX);
}

export function dropRun(ids: readonly string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}

export function readTray(): string[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(TRAY_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeTray(ids: readonly string[]): void {
  try {
    sessionStorage.setItem(TRAY_KEY, JSON.stringify(ids));
  } catch {
    // Storage blocked: the tray only lives for this page.
  }
  window.dispatchEvent(new Event(TRAY_EVENT));
}

/** Watch a run in the tray (call right after a run was started). */
export function trackRun(id: string): void {
  writeTray(addRun(readTray(), id));
}

export function untrackRun(id: string): void {
  writeTray(dropRun(readTray(), id));
}

export type TrayRow = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  tone: Tone;
  /** 0..1 share of recipe steps already in the ledger. */
  progress: number;
  dots: RowState[];
  live: boolean;
};

const STATUS_TEXT: Readonly<Record<RunState["status"], { text: string; tone: Tone }>> = {
  queued: { text: "Queued", tone: "neutral" },
  running: { text: "Researching", tone: "unsure" },
  paused: { text: "Needs your answer", tone: "inference" },
  done: { text: "Brief ready", tone: "ok" },
  failed: { text: "Failed", tone: "conflict" },
};

export function isLive(status: RunState["status"]): boolean {
  return status === "queued" || status === "running" || status === "paused";
}

export function trayRow(state: Pick<RunState, "id" | "subject" | "headline" | "role" | "position" | "status" | "step" | "mentions" | "failed_step" | "step_index" | "step_count">): TrayRow {
  const first = firstName(state.subject);
  const hiring = state.position?.title ?? state.role;
  return {
    id: state.id,
    title: first === null ? "New brief" : state.subject,
    detail: hiring ?? state.headline,
    status: STATUS_TEXT[state.status].text,
    tone: STATUS_TEXT[state.status].tone,
    progress: state.step_count > 0 ? Math.min(1, Math.max(0, state.step_index / state.step_count)) : 0,
    dots: stepRows(state),
    live: isLive(state.status),
  };
}
