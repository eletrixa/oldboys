/**
 * Tests for the run tray helpers: list operations, storage fallbacks and the row projection.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/__tests__/run-tray-store.test.ts
 * Deps:    vitest, ../run-tray-store
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - addRun puts the newest first, dedupes and caps at TRAY_MAX; dropRun removes
 * - readTray survives missing or broken storage; trackRun of the newest id is a no-op
 * - trayRow: title before and after the name is known, progress share (time-weighted with a phase projection), live flag per status
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { runProgress } from "@/domain/run-eta";
import { hiringRecipe } from "@/recipe/goals/hiring";
import { addRun, dropRun, isLive, readTray, TRAY_MAX, trackRun, trayRow } from "../run-tray-store";

const base = {
  id: "r1",
  subject: "",
  headline: "Data engineer at Acme",
  role: "Senior Data Engineer",
  position: null,
  status: "running" as const,
  step: "seed_profile",
  mentions: 0,
  failed_step: null,
  step_index: 2,
  step_count: 8,
  created_at: "2026-10-09T10:00:00.000Z",
  cost: { usd: 0, source_calls: 0, llm_calls: 0, duration_ms: 0 },
};

describe("addRun / dropRun", () => {
  it("newest first, no duplicates, capped", () => {
    expect(addRun(["a", "b"], "c")).toEqual(["c", "a", "b"]);
    expect(addRun(["a", "b"], "b")).toEqual(["b", "a"]);
    const many = Array.from({ length: TRAY_MAX }, (_, i) => `r${String(i)}`);
    expect(addRun(many, "new")).toHaveLength(TRAY_MAX);
    expect(dropRun(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("readTray", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gives [] when storage is missing or holds junk", () => {
    vi.stubGlobal("sessionStorage", undefined);
    expect(readTray()).toEqual([]);
    vi.stubGlobal("sessionStorage", { getItem: () => "{not json" });
    expect(readTray()).toEqual([]);
    vi.stubGlobal("sessionStorage", { getItem: () => JSON.stringify(["a", 3, "b"]) });
    expect(readTray()).toEqual(["a", "b"]);
  });
});

describe("trackRun", () => {
  it("writes nothing and dispatches no event when the id is already the newest entry", () => {
    const setItem = vi.fn();
    const dispatchEvent = vi.fn();
    vi.stubGlobal("sessionStorage", { getItem: () => JSON.stringify(["a", "b"]), setItem });
    vi.stubGlobal("window", { dispatchEvent });
    trackRun("a");
    expect(setItem).not.toHaveBeenCalled();
    expect(dispatchEvent).not.toHaveBeenCalled();
    trackRun("b");
    expect(setItem).toHaveBeenCalledWith("oldboys.tray", JSON.stringify(["b", "a"]));
    expect(dispatchEvent).toHaveBeenCalledOnce();
  });
});

describe("trayRow", () => {
  it("names the run once the subject is known and shows what it is hiring for", () => {
    expect(trayRow(base)).toMatchObject({ title: "New brief", detail: "Senior Data Engineer", status: "Researching", progress: 0.25, live: true });
    expect(trayRow({ ...base, subject: "Ada Lovelace", position: { id: "p", title: "Head of Data" } })).toMatchObject({ title: "Ada Lovelace", detail: "Head of Data" });
    expect(trayRow({ ...base, role: null, position: null }).detail).toBe("Data engineer at Acme");
  });

  it("with a phase projection the share is time-weighted and the clock fields travel along", () => {
    const progress = runProgress(hiringRecipe.steps, [], base.created_at);
    const row = trayRow({ ...base, progress }, Date.parse(base.created_at) + 20_000);
    expect(row.progress).toBeGreaterThan(0);
    expect(row.progress).toBeLessThan(0.2);
    expect(row).toMatchObject({ phases: progress, raw_status: "running", mentions: 0, created_at: base.created_at });
  });

  it("done and failed runs are not live and keep a sane progress", () => {
    expect(trayRow({ ...base, status: "done", step_index: 8 })).toMatchObject({ status: "Brief ready", tone: "ok", progress: 1, live: false });
    expect(trayRow({ ...base, status: "failed", step_count: 0 })).toMatchObject({ tone: "conflict", progress: 0, live: false });
    expect(isLive("paused")).toBe(true);
  });
});
