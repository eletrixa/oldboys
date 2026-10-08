/**
 * storage.local access: settings and the tracked-run queue, validated on every read.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/src/lib/store.ts
 * Deps:    wxt/browser, zod
 * Tested:  extension/src/__tests__/background-logic.test.ts (through the fake browser)
 *
 * Key responsibilities:
 * - loadSettings / saveSettings, loadRuns / saveRuns
 * - Corrupt or missing data reads as defaults, never throws
 *
 * Design constraints:
 * - Only storage.local (persists across restarts; the worker may die any time)
 */
import { browser } from "wxt/browser";
import { z } from "zod";
import { Settings } from "./api";
import { TrackedRun } from "./poll";

const KEY_SETTINGS = "settings";
const KEY_RUNS = "runs";

export async function loadSettings(): Promise<Settings> {
  const got = await browser.storage.local.get(KEY_SETTINGS);
  const parsed = Settings.safeParse(got[KEY_SETTINGS] ?? {});
  return parsed.success ? parsed.data : Settings.parse({});
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [KEY_SETTINGS]: settings });
}

export async function loadRuns(): Promise<TrackedRun[]> {
  const got = await browser.storage.local.get(KEY_RUNS);
  const parsed = z.array(TrackedRun).safeParse(got[KEY_RUNS] ?? []);
  return parsed.success ? parsed.data : [];
}

export async function saveRuns(runs: readonly TrackedRun[]): Promise<void> {
  await browser.storage.local.set({ [KEY_RUNS]: runs });
}
