/**
 * Tests for the background behaviour against WXT's in-memory fake browser.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/src/__tests__/background-logic.test.ts
 * Deps:    vitest, wxt/testing (fakeBrowser)
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - ensureAlarm creates the poll alarm once
 * - startFromMark stores the run and sets the badge; a start failure notifies and rethrows
 * - pollAll fetches only due runs, notifies on transitions, persists, updates the badge
 * - openRun opens the report tab and clears the badge for that run
 *
 * Design constraints:
 * - fakeBrowser.reset() before every test; notifications and tabs are observed through spies
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { ensureAlarm, forgetRun, openRun, pollAll, startFromMark } from "../background-logic";
import { type Fetch } from "../lib/api";
import { loadRuns, saveRuns, saveSettings } from "../lib/store";
import { Settings } from "../lib/api";

const mark = { subject: "Jan Novák", anchor: "Prague", goal: "hiring" as const, sourceUrl: "https://www.linkedin.com/in/jan" };

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const statusBody = (overrides: Record<string, unknown>): unknown => ({
  id: "r1",
  subject: "Jan Novák",
  goal: "hiring",
  status: "running",
  facts: 0,
  inferences: 0,
  statements: 0,
  gaps: 0,
  needsAnswer: null,
  createdAt: "2026-10-08T20:00:00.000Z",
  ...overrides,
});

beforeEach(async () => {
  fakeBrowser.reset();
  await saveSettings(Settings.parse({ token: "t0k", apiBase: "https://oldboys.test" }));
});

describe("ensureAlarm", () => {
  it("creates the poll alarm once", async () => {
    await ensureAlarm();
    await ensureAlarm();
    expect(await fakeBrowser.alarms.getAll()).toHaveLength(1);
    expect(await fakeBrowser.alarms.get("poll")).toMatchObject({ periodInMinutes: 1 });
  });
});

describe("startFromMark", () => {
  it("tracks the new run and shows a badge of 0 until something needs the user", async () => {
    const fetchImpl: Fetch = () => Promise.resolve(json(201, { id: "r1" }));
    const run = await startFromMark(mark, fetchImpl, new Date("2026-10-08T20:00:00.000Z"));
    expect(run).toMatchObject({ runId: "r1", status: "queued", subject: "Jan Novák" });
    expect(await loadRuns()).toHaveLength(1);
    expect(await fakeBrowser.action.getBadgeText({})).toBe("");
  });

  it("notifies and rethrows when the API refuses", async () => {
    const create = vi.spyOn(fakeBrowser.notifications, "create");
    const fetchImpl: Fetch = () => Promise.resolve(json(401, {}));
    await expect(startFromMark(mark, fetchImpl)).rejects.toMatchObject({ code: "unauthorized" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(await loadRuns()).toHaveLength(0);
  });
});

describe("pollAll", () => {
  it("polls due runs only, notifies on done and sets the badge", async () => {
    await saveRuns([
      { runId: "r1", subject: "Jan Novák", goal: "hiring", sourceUrl: mark.sourceUrl, status: "running", facts: 0, inferences: 0, gaps: 0, candidates: 0, opened: false, startedAt: "x", checkedAt: null },
      { runId: "r2", subject: "Done Already", goal: "hiring", sourceUrl: mark.sourceUrl, status: "done", facts: 1, inferences: 0, gaps: 0, candidates: 0, opened: true, startedAt: "x", checkedAt: null },
    ]);
    const urls: string[] = [];
    const fetchImpl: Fetch = (url) => {
      urls.push(url);
      return Promise.resolve(json(200, statusBody({ status: "done", facts: 11, inferences: 3, gaps: 2 })));
    };
    const create = vi.spyOn(fakeBrowser.notifications, "create");
    const next = await pollAll(fetchImpl, new Date("2026-10-08T21:00:00.000Z"));
    expect(urls).toEqual(["https://oldboys.test/api/runs/r1"]);
    expect(next.find((r) => r.runId === "r1")).toMatchObject({ status: "done", facts: 11, checkedAt: "2026-10-08T21:00:00.000Z" });
    expect(create).toHaveBeenCalledWith("r1", expect.objectContaining({ title: "Jan Novák: profile complete" }));
    expect(await fakeBrowser.action.getBadgeText({})).toBe("1");
  });

  it("keeps a run untouched when the API is unreachable", async () => {
    await saveRuns([{ runId: "r1", subject: "Jan", goal: "hiring", sourceUrl: mark.sourceUrl, status: "running", facts: 0, inferences: 0, gaps: 0, candidates: 0, opened: false, startedAt: "x", checkedAt: null }]);
    const fetchImpl: Fetch = () => Promise.reject(new TypeError("offline"));
    const next = await pollAll(fetchImpl);
    expect(next[0]).toMatchObject({ status: "running", checkedAt: null });
  });
});

describe("openRun and forgetRun", () => {
  it("opens the report page, marks the run opened and clears its badge count", async () => {
    await saveRuns([{ runId: "r1", subject: "Jan", goal: "hiring", sourceUrl: mark.sourceUrl, status: "done", facts: 1, inferences: 0, gaps: 0, candidates: 0, opened: false, startedAt: "x", checkedAt: null }]);
    const create = vi.spyOn(fakeBrowser.tabs, "create");
    await openRun("r1");
    expect(create).toHaveBeenCalledWith({ url: "https://oldboys.test/runs/r1" });
    expect((await loadRuns())[0]?.opened).toBe(true);
    expect(await fakeBrowser.action.getBadgeText({})).toBe("");
    expect(await forgetRun("r1")).toEqual([]);
  });
});
