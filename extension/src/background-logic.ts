/**
 * Background behaviour as plain async functions: start a run, poll the queue, open a report.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/src/background-logic.ts
 * Deps:    wxt/browser, src/lib/*
 * Tested:  extension/src/__tests__/background-logic.test.ts
 *
 * Key responsibilities:
 * - startFromMark: POST the mark, track the run, update the badge
 * - pollAll: GET every non-terminal run, notify on transitions, persist, update the badge
 * - openRun: open the app's report page in a tab and mark the run as opened
 *
 * Design constraints:
 * - No listeners here; entrypoints/background.ts registers them at top level (MV3 wake-up rule)
 * - Notification id == runId so a click maps back to the run without extra state
 * - One notification per run per tick at most (Firefox drops rapid repeats)
 */
import { browser } from "wxt/browser";
import { ApiError, getStatus, runUrl, startRun, type Fetch } from "./lib/api";
import { type Mark } from "./lib/mark";
import { applyStatus, badgeText, dueRuns, transition, type TrackedRun } from "./lib/poll";
import { loadRuns, loadSettings, saveRuns } from "./lib/store";

export const ALARM_POLL = "poll";
export const POLL_PERIOD_MIN = 1;
const ICON = "icon/48.png";

export async function ensureAlarm(): Promise<void> {
  const existing = await browser.alarms.get(ALARM_POLL);
  if (!existing) await browser.alarms.create(ALARM_POLL, { periodInMinutes: POLL_PERIOD_MIN });
}

async function setBadge(runs: readonly TrackedRun[]): Promise<void> {
  await browser.action.setBadgeText({ text: badgeText(runs) });
}

async function notify(id: string, title: string, message: string): Promise<void> {
  await browser.notifications.create(id, { type: "basic", iconUrl: ICON, title, message });
}

export async function startFromMark(mark: Mark, fetchImpl: Fetch, now: Date = new Date()): Promise<TrackedRun> {
  const settings = await loadSettings();
  const runs = await loadRuns();
  try {
    const { id, reused } = await startRun(settings, mark, fetchImpl);
    const existing = runs.find((r) => r.runId === id);
    const run: TrackedRun = existing ?? {
      runId: id,
      subject: mark.subject,
      goal: mark.goal,
      sourceUrl: mark.sourceUrl,
      status: "queued",
      facts: 0,
      inferences: 0,
      gaps: 0,
      candidates: 0,
      opened: false,
      startedAt: now.toISOString(),
      checkedAt: null,
    };
    const next = existing ? runs : [run, ...runs];
    await saveRuns(next);
    await setBadge(next);
    if (reused) await notify(id, `${mark.subject}: already researched`, "Reusing the run from the last 24 h. Click to open.");
    return run;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Could not reach the oldboys API.";
    await notify(`error:${now.toISOString()}`, "oldboys: could not start", message);
    throw error;
  }
}

export async function pollAll(fetchImpl: Fetch, now: Date = new Date()): Promise<TrackedRun[]> {
  const settings = await loadSettings();
  const runs = await loadRuns();
  const due = dueRuns(runs);
  if (due.length === 0) return runs;
  const updated = new Map<string, TrackedRun>();
  for (const run of due) {
    try {
      const status = await getStatus(settings, run.runId, fetchImpl);
      const notice = transition(run.status, status);
      updated.set(run.runId, applyStatus(run, status, now));
      if (notice) await notify(run.runId, notice.title, notice.message);
    } catch (error) {
      if (error instanceof ApiError && error.code === "not-found") {
        updated.set(run.runId, { ...run, status: "failed", checkedAt: now.toISOString() });
      }
      // Any other failure: keep the run as is and try again next tick.
    }
  }
  const next = runs.map((r) => updated.get(r.runId) ?? r);
  await saveRuns(next);
  await setBadge(next);
  return next;
}

export async function openRun(runId: string): Promise<void> {
  const settings = await loadSettings();
  const runs = await loadRuns();
  const next = runs.map((r) => (r.runId === runId ? { ...r, opened: true } : r));
  await saveRuns(next);
  await setBadge(next);
  await browser.tabs.create({ url: runUrl(settings, runId) });
}

export async function forgetRun(runId: string): Promise<TrackedRun[]> {
  const runs = (await loadRuns()).filter((r) => r.runId !== runId);
  await saveRuns(runs);
  await setBadge(runs);
  return runs;
}
