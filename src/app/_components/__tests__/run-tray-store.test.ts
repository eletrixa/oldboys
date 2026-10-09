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
 * - readTray survives missing or broken storage
 * - trayRow: title before and after the name is known, progress share, live flag per status
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { addRun, dropRun, isLive, readTray, TRAY_MAX, trayRow } from "../run-tray-store";

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

describe("trayRow", () => {
  it("names the run once the subject is known and shows what it is hiring for", () => {
    expect(trayRow(base)).toMatchObject({ title: "New brief", detail: "Senior Data Engineer", status: "Researching", progress: 0.25, live: true });
    expect(trayRow({ ...base, subject: "Ada Lovelace", position: { id: "p", title: "Head of Data" } })).toMatchObject({ title: "Ada Lovelace", detail: "Head of Data" });
    expect(trayRow({ ...base, role: null, position: null }).detail).toBe("Data engineer at Acme");
  });

  it("done and failed runs are not live and keep a sane progress", () => {
    expect(trayRow({ ...base, status: "done", step_index: 8 })).toMatchObject({ status: "Brief ready", tone: "ok", progress: 1, live: false });
    expect(trayRow({ ...base, status: "failed", step_count: 0 })).toMatchObject({ tone: "conflict", progress: 0, live: false });
    expect(isLive("paused")).toBe(true);
  });
});
