/**
 * Tests for the progress lines of the run page and the tray (plans/015).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/progress-text.test.ts
 * Deps:    vitest, ../progress-text, ../state, src/domain/run-eta, src/recipe/goals/hiring
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - timeLine: range + elapsed while running, the paused sentence, the longer-than-usual sentence without a number,
 *   "Stopped after" on failure, nothing when done
 * - phaseDetails: measured time for finished phases, what is read for the active one, the typical time for the rest
 * - foundSoFar / trayLine / typicalText wording
 * - stepRows reads the open phase from `progress`; phaseLabels and readingText wording
 *
 * Design constraints:
 * - The hiring recipe is the real one, so a renamed step shows up here
 */
import { describe, expect, it } from "vitest";
import { progressView, runProgress } from "@/domain/run-eta";
import { hiringRecipe } from "@/recipe/goals/hiring";
import { foundSoFar, LONGER_TEXT, PAUSED_TEXT, phaseDetails, timeLine, trayLine, typicalText } from "../progress-text";
import { phaseLabels, readingText, stepRows } from "../state";

const T0 = "2026-10-09T10:00:00.000Z";
const ms = (s: number): number => Date.parse(T0) + s * 1000;
const row = (step: string, endS: number, durS: number): { step: string; ts: string; ms: number } => ({ step, ts: new Date(ms(endS)).toISOString(), ms: durS * 1000 });
const searchDone = ["seed_profile", "serp_person", "social_serp", "instagram_search", "facebook_search", "github_search"].map((id, i) => row(id, 40 + i, 30));
const cost = { usd: 0.1, source_calls: 3, llm_calls: 1, duration_ms: 200_000 };

describe("timeLine", () => {
  it("running: a range and the elapsed time", () => {
    const p = runProgress(hiringRecipe.steps, [], T0);
    const v = progressView(p, "running", ms(70));
    expect(timeLine(v, { status: "running", created_at: T0, cost }, ms(70))).toMatch(/^About \d+ to \d+ min left · 1 min 10 s in$/);
  });

  it("paused: no countdown; longer than usual: no number; failed: stopped after; done: nothing", () => {
    const p = runProgress(hiringRecipe.steps, searchDone, T0);
    expect(timeLine(progressView(p, "paused", ms(900)), { status: "paused", created_at: T0, cost }, ms(900))).toBe(PAUSED_TEXT);
    const late = progressView(p, "running", ms(45 + 60)); // lineup typical 7 s, 2.5x = 17.5 s
    expect(late.longer).toBe(true);
    expect(timeLine(late, { status: "running", created_at: T0, cost }, ms(105))).toBe(`${LONGER_TEXT} · 1 min 45 s in`);
    expect(timeLine(progressView(p, "failed", ms(100)), { status: "failed", created_at: T0, cost }, ms(100))).toBe("Stopped after 3 min 20 s");
    expect(timeLine(progressView(p, "done", ms(100)), { status: "done", created_at: T0, cost }, ms(100))).toBeNull();
  });
});

describe("phaseDetails and rows", () => {
  it("finished phases show their measured time, the active one what it reads, the rest the typical time", () => {
    const rows = [...searchDone, row("resolve_lineup", 52, 7), row("linkedin_profile", 55, 2)];
    const p = runProgress(hiringRecipe.steps, rows, T0);
    const state = { status: "running" as const, step: "linkedin_profile", mentions: 4, failed_step: null, progress: p };
    const r = stepRows(state);
    expect(r).toEqual(["done", "done", "active", "todo", "todo"]);
    const d = phaseDetails(p, progressView(p, "running", ms(60)), r);
    expect(d[0]).toBe("45 s");
    expect(d[1]).toBe("7 s");
    expect(d[2]).toMatch(/^still to read: .+ and \d+ more$/);
    expect(d[3]).toBe("~55 s");
    expect(phaseDetails(p, progressView(p, "paused", ms(60)), r, true)[2]).toMatch(/^next: /);
    expect(d[4]).toBe("~2 min");
  });

  it("a failed run marks the open phase as failed", () => {
    const p = runProgress(hiringRecipe.steps, searchDone, T0);
    expect(stepRows({ status: "failed", step: "serp_person", mentions: 0, failed_step: "resolve_lineup", progress: p })).toEqual(["done", "failed", "todo", "todo", "todo"]);
  });

  it("labels: mentions found, the first name, the degraded note", () => {
    expect(phaseLabels("Ada", 3, false)[0]).toBe("Found 3 public mentions");
    expect(phaseLabels(null, 0, true)).toEqual([
      "Searching public sources",
      "Making sure we have the right person",
      "Reading their work history and projects (skipped: AI unavailable)",
      "Double-checking facts against each other (skipped: AI unavailable)",
      "Writing your brief",
    ]);
  });

  it("readingText names sources in plain words and counts the rest", () => {
    expect(readingText(["linkedin_profile", "github_profile", "x_profile", "youtube_channel", "unknown_step"])).toBe("LinkedIn, GitHub, X and 1 more");
    expect(readingText(["serp_person", "social_serp"], 2)).toBe("Google, social profile search");
    expect(readingText([])).toBeNull();
  });
});

describe("foundSoFar, trayLine, typicalText", () => {
  it("counts mentions, confirmed accounts and open questions", () => {
    const c = (decision: "merge" | "possibly-same-as" | "rejected") => ({ decision }) as never;
    expect(foundSoFar({ mentions: 0, candidates: [] })).toBeNull();
    expect(foundSoFar({ mentions: 1, candidates: [c("merge"), c("possibly-same-as"), c("rejected")] })).toBe("Found so far: 1 public mention · 1 account confirmed · 1 awaiting your answer");
  });

  it("the tray line pairs the time with what is happening", () => {
    const p = runProgress(hiringRecipe.steps, [], T0);
    const v = progressView(p, "running", ms(10));
    expect(trayLine(v, { status: "running", created_at: T0, cost, mentions: 0 }, ms(10))).toMatch(/^About \d+ to \d+ min left · still to read: .+$/);
    expect(trayLine(v, { status: "paused", created_at: T0, cost, mentions: 0 }, ms(10))).toBe("Answer one question to continue");
    expect(trayLine(v, { status: "done", created_at: T0, cost, mentions: 0 }, ms(10))).toBeNull();
    const tail = runProgress(hiringRecipe.steps, hiringRecipe.steps.filter((s) => s.kind !== "synthesize").map((s, i) => row(s.id, 100 + i, 1)), T0);
    expect(trayLine(progressView(tail, "running", ms(140)), { status: "running", created_at: T0, cost, mentions: 9 }, ms(140))).toMatch(/left · writing the brief$/);
  });

  it("typicalText rounds to 5 s under a minute and to minutes above", () => {
    expect(typicalText(7_000)).toBe("~5 s");
    expect(typicalText(42_000)).toBe("~40 s");
    expect(typicalText(95_000)).toBe("~2 min");
  });
});
