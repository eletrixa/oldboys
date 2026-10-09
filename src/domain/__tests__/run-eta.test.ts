/**
 * Tests for the run progress projection: phases, pool-aware typical times, the remaining range and the honesty rules.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/run-eta.test.ts
 * Deps:    vitest, src/domain/run-eta, src/recipe/goals/hiring
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Steps land in the five phases by kind and by their position relative to the lineup
 * - Pool phases count the longest step (or the window bottleneck), serial phases add up
 * - Phase start = earliest (ts - ms) of its rows, else the previous phase's end; end only once every step has a row
 * - View: share grows with time but never reaches 1 before the end; the range is 0.6x to 2x the estimate; paused shows no
 *   countdown; past 2.5x the phase's typical time the estimate is withdrawn; done is share 1
 * - remainingText rounds to whole minutes and says "under a minute" below it
 *
 * Design constraints:
 * - Fixtures stay inline; the hiring recipe is the real one so a renamed step shows up here
 */
import { describe, expect, it } from "vitest";
import { PHASES, phaseOf, progressView, remainingText, runPace, runProgress, TYPICAL_MS, typicalMs } from "@/domain/run-eta";
import { hiringRecipe } from "@/recipe/goals/hiring";
import type { Step } from "@/recipe/step";

const T0 = "2026-10-09T10:00:00.000Z";
/** search 35 + lineup 7 + read 25 + check 54 + write 100 (seconds) for the fixture recipe below. */
const TOTAL = 221_000;
const AFTER_SEARCH = TOTAL - 35_000;
const at = (s: number): string => new Date(Date.parse(T0) + s * 1000).toISOString();
const ms = (s: number): number => Date.parse(T0) + s * 1000;
const row = (step: string, endS: number, durS: number): { step: string; ts: string; ms: number } => ({ step, ts: at(endS), ms: durS * 1000 });

const steps: Step[] = [
  { id: "seed_profile", kind: "seed" },
  { id: "serp_person", kind: "serp" },
  { id: "social_serp", kind: "serp" },
  { id: "resolve_lineup", kind: "resolve" },
  { id: "youtube_channel", kind: "actor" },
  { id: "github_profile", kind: "actor" },
  { id: "extract_claims", kind: "extract" },
  { id: "verify_claims", kind: "verify" },
  { id: "synthesize_report", kind: "synthesize" },
];

describe("phases and typical times", () => {
  it("puts collectors before the lineup in search and after it in read", () => {
    expect(phaseOf({ kind: "serp" }, false)).toBe("search");
    expect(phaseOf({ kind: "actor" }, true)).toBe("read");
    expect(phaseOf({ kind: "resolve" }, false)).toBe("lineup");
    expect(phaseOf({ kind: "verify" }, true)).toBe("check");
    expect(phaseOf({ kind: "synthesize" }, true)).toBe("write");
  });

  it("knows every hiring step; an unknown step falls back to its kind", () => {
    for (const s of hiringRecipe.steps) expect(TYPICAL_MS[s.id], s.id).toBeDefined();
    expect(typicalMs({ id: "new_thing", kind: "serp" })).toBe(30_000);
  });

  it("pool phases take as long as their longest step, serial phases add up", () => {
    const p = runProgress(steps, [], T0);
    const by = Object.fromEntries(p.phases.map((x) => [x.key, x]));
    expect(by.search?.typical_ms).toBe(35_000); // seed 7, serp_person 30, social 35 in parallel
    expect(by.read?.typical_ms).toBe(25_000); // youtube 25, github 1
    expect(by.check?.typical_ms).toBe(54_000); // extract 40 + verify 14
    expect(by.write?.typical_ms).toBe(100_000);
    expect(p.typical_total_ms).toBe(TOTAL);
    expect(p.phases.map((x) => x.key)).toEqual(PHASES);
  });

  it("a window of 6 is the bottleneck when many short steps queue", () => {
    const many: Step[] = Array.from({ length: 12 }, (_, i) => ({ id: `s${String(i)}`, kind: "actor" }));
    const p = runProgress([{ id: "resolve_lineup", kind: "resolve" }, ...many], [], T0);
    expect(p.phases.find((x) => x.key === "read")?.typical_ms).toBe(10_000); // 12 x 5 s / 6
  });
});

describe("runProgress over the ledger", () => {
  it("starts the first phase at creation and ends a phase when every step has a row", () => {
    const rows = [row("seed_profile", 7, 7), row("social_serp", 40, 33), row("serp_person", 45, 38)];
    const p = runProgress(steps, rows, T0);
    const search = p.phases[0];
    expect(search?.done).toBe(3);
    expect(search?.left).toEqual([]);
    expect(search?.started_at).toBe(T0);
    expect(search?.ended_at).toBe(at(45));
    const lineup = p.phases[1];
    expect(lineup?.started_at).toBe(at(45)); // under way since the searches ended, none of its steps finished yet
    expect(lineup?.ended_at).toBeNull();
  });

  it("the active phase starts at the earliest known start of its finished steps, else the previous phase's end", () => {
    const rows = [row("seed_profile", 7, 7), row("social_serp", 40, 33), row("serp_person", 45, 38), row("resolve_lineup", 52, 7), row("github_profile", 61, 1)];
    const p = runProgress(steps, rows, T0);
    const read = p.phases[2];
    expect(read?.started_at).toBe(at(60));
    expect(read?.left).toEqual(["youtube_channel"]);
    expect(read?.left_ms).toBe(25_000);
    expect(read?.ended_at).toBeNull();
    const check = p.phases[3];
    expect(check?.started_at).toBeNull();
  });

  it("a phase never starts before the previous one ended, whatever its rows' ms say", () => {
    const rows = [row("seed_profile", 7, 7), row("social_serp", 40, 33), row("serp_person", 45, 38), row("resolve_lineup", 46, 30)];
    expect(runProgress(steps, rows, T0).phases[1]?.started_at).toBe(at(45));
  });

  it("a phase with no steps is skipped: it inherits the previous end", () => {
    // Without a lineup every collector is a search-phase step, so all five need rows before the phase ends
    const noLineup = steps.filter((s) => s.kind !== "resolve");
    const p = runProgress(noLineup, [row("seed_profile", 7, 7), row("social_serp", 40, 33), row("youtube_channel", 44, 30), row("github_profile", 44, 1), row("serp_person", 45, 38)], T0);
    expect(p.phases[1]).toMatchObject({ key: "lineup", steps: 0, started_at: at(45), ended_at: at(45) });
    expect(p.phases[2]?.started_at).toBe(at(45));
  });

  it("ignores rows with an unreadable time and rows of steps outside the recipe", () => {
    const p = runProgress(steps, [{ step: "seed_profile", ts: "nope", ms: 1 }, row("run", 10, 0), row("translate", 11, 3)], T0);
    expect(p.phases[0]?.done).toBe(0);
  });
});

describe("progressView", () => {
  const done = [row("seed_profile", 7, 7), row("social_serp", 40, 33), row("serp_person", 45, 38)];

  it("queued: nothing done, the whole typical time remains as a range", () => {
    const v = progressView(runProgress(steps, [], T0), "queued", ms(0));
    expect(v.share).toBe(0);
    expect(v.active).toBe("search");
    expect(v.remaining).toEqual({ low_ms: Math.round(TOTAL * 0.6), high_ms: Math.round(TOTAL * 2.0) });
    expect(v.reading).toEqual(["seed_profile", "serp_person", "social_serp"]);
  });

  it("share grows with time inside a phase but never completes it before its rows arrive", () => {
    const p = runProgress(steps, [], T0);
    const early = progressView(p, "running", ms(5));
    const late = progressView(p, "running", ms(34));
    const over = progressView(p, "running", ms(50));
    expect(early.share).toBeGreaterThan(0);
    expect(late.share).toBeGreaterThan(early.share);
    expect(over.share).toBeLessThanOrEqual(0.95 * (35_000 / TOTAL) + 1e-9);
    expect(over.remaining?.low_ms).toBe(Math.round(AFTER_SEARCH * 0.6)); // only the later phases are left
  });

  it("a finished phase counts in full and the next one starts from its end", () => {
    const v = progressView(runProgress(steps, done, T0), "running", ms(46));
    expect(v.active).toBe("lineup");
    expect(v.share).toBeCloseTo(35_000 / TOTAL, 1);
    expect(v.phase_elapsed_ms).toBe(1_000);
  });

  it("paused: no countdown, no phase clock (human time is not research time)", () => {
    const v = progressView(runProgress(steps, [...done, row("resolve_lineup", 52, 7)], T0), "paused", ms(600));
    expect(v.active).toBe("read");
    expect(v.remaining).toBeNull();
    expect(v.phase_elapsed_ms).toBe(0);
  });

  it("withdraws the estimate once the phase ran past 2.5x its typical time", () => {
    // The searches took 45 s against 35 s typical, so the pace is sqrt(45/35) = 1.13 and the lineup is expected in 7.9 s
    const v = progressView(runProgress(steps, done, T0), "running", ms(45 + 21));
    expect(v.longer).toBe(true);
    expect(v.remaining).toBeNull();
    expect(progressView(runProgress(steps, done, T0), "running", ms(45 + 19)).longer).toBe(false);
  });

  it("done: share 1, nothing active", () => {
    expect(progressView(runProgress(steps, [], T0), "done", ms(0))).toMatchObject({ share: 1, active: null, remaining: null });
  });

  it("failed: the clock stops, the share stays where it was", () => {
    const v = progressView(runProgress(steps, done, T0), "failed", ms(60));
    expect(v.remaining).toBeNull();
    expect(v.share).toBeGreaterThan(0.17);
  });
});

describe("runPace", () => {
  it("is 1 before any phase ended, the damped actual-over-typical ratio after, clamped to 0.6x to 2x", () => {
    expect(runPace([])).toBe(1);
    const phase = (tookS: number, typicalS: number) => ({ started_at: T0, ended_at: at(tookS), typical_ms: typicalS * 1000, steps: 1 });
    expect(runPace([phase(140, 35)])).toBe(2);
    expect(runPace([phase(10, 40)])).toBe(0.6);
    expect(runPace([phase(70, 35), phase(7, 7)])).toBeCloseTo(Math.sqrt(77 / 42), 5);
    expect(runPace([{ started_at: T0, ended_at: T0, typical_ms: 0, steps: 0 }])).toBe(1);
  });
});

describe("remainingText", () => {
  it("whole minutes as a range, under a minute below it, nothing when withdrawn", () => {
    expect(remainingText({ remaining: { low_ms: 120_000, high_ms: 250_000 } })).toBe("about 2 to 5 min left");
    expect(remainingText({ remaining: { low_ms: 100_000, high_ms: 110_000 } })).toBe("about 2 min left");
    expect(remainingText({ remaining: { low_ms: 20_000, high_ms: 90_000 } })).toBe("up to 2 min left");
    expect(remainingText({ remaining: { low_ms: 10_000, high_ms: 40_000 } })).toBe("under a minute left");
    expect(remainingText({ remaining: null })).toBeNull();
  });
});
