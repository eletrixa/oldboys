/**
 * Tests for the run cost and duration projection over ledger rows.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/run-cost.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Empty ledger reads as zeros; costs sum and round to 2 decimals; calls are counted by kind
 * - Pause time is excluded; an open pause stops the clock at the pause
 * - A later report translation row (idea #24) adds cost and a model call, never research time
 * - Invalid createdAt and negative values clamp to 0
 * - formatDuration picks seconds, minutes or hours
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { formatDuration, runCost, type CostRow } from "@/domain/run-cost";

const START = "2026-10-08T20:00:00.000Z";

function row(kind: string, ts: string, cost_usd = 0, ms = 0): CostRow {
  return { ts: `2026-10-08T${ts}.000Z`, kind, cost_usd, ms, ref_json: kind === "llm" ? '{"calls":1}' : null };
}

describe("runCost", () => {
  it("returns zeros for an empty ledger", () => {
    expect(runCost([], START)).toEqual({ usd: 0, source_calls: 0, llm_calls: 0, duration_ms: 0 });
  });

  it("counts llm rows and measures from createdAt to the last row", () => {
    const cost = runCost([row("llm", "20:00:10", 0.05), row("llm", "20:01:00", 0.07)], START);
    expect(cost).toEqual({ usd: 0.12, source_calls: 0, llm_calls: 2, duration_ms: 60_000 });
  });

  it("counts model calls from ref.calls, so a failed model adds none", () => {
    const llm = (ts: string, ref: string | null): CostRow => ({ ...row("llm", ts), ref_json: ref });
    const cost = runCost([llm("20:00:10", '{"calls":0}'), llm("20:00:20", '{"calls":3}'), llm("20:00:30", null), llm("20:00:40", "{oops")], START);
    expect(cost.llm_calls).toBe(3);
  });

  it("projects 0 AI calls for a keyless run (role, resolve, extract, synthesize all degraded)", () => {
    const refs = ['{"questions":3,"calls":0}', '{"candidates":[],"calls":0}', '{"claims":0,"calls":0}', '{"brief":true,"calls":0}', null];
    const rows = refs.map((ref, i): CostRow => ({ ...row("llm", `20:00:1${String(i)}`), ref_json: ref }));
    expect(runCost([...rows, row("call", "20:00:30")], START)).toMatchObject({ source_calls: 1, llm_calls: 0 });
  });

  it("sums and rounds mixed call, llm and decision rows", () => {
    const cost = runCost(
      [
        row("call", "20:00:05", 0.104),
        row("call", "20:00:20", 0.101),
        row("llm", "20:01:00", 0.0333),
        row("decision", "20:03:12", 0),
      ],
      START,
    );
    expect(cost.usd).toBe(0.24);
    expect(cost.source_calls).toBe(2);
    expect(cost.llm_calls).toBe(1);
    expect(cost.duration_ms).toBe(192_000);
  });

  it("adds a later report translation's cost and model call but not its time", () => {
    const translate: CostRow = { ...row("llm", "23:30:00", 0.04), step: "translate" };
    const cost = runCost([row("llm", "20:01:00", 0.07), translate], START);
    expect(cost).toEqual({ usd: 0.11, source_calls: 0, llm_calls: 2, duration_ms: 60_000 });
  });

  it("excludes time spent paused", () => {
    const cost = runCost(
      [row("call", "20:01:00", 0.1), row("pause", "20:02:00"), row("decision", "20:12:00"), row("llm", "20:13:00", 0.2)],
      START,
    );
    // 13 min wall clock minus a 10 min pause
    expect(cost.duration_ms).toBe(3 * 60_000);
  });

  it("stops the clock at an open pause", () => {
    const cost = runCost([row("call", "20:01:00", 0.1), row("pause", "20:02:00")], START);
    expect(cost.duration_ms).toBe(2 * 60_000);
  });

  it("reads an invalid createdAt as zero duration but keeps cost and counts", () => {
    const cost = runCost([row("call", "20:01:00", 0.1), row("llm", "20:02:00", 0.2)], "not a date");
    expect(cost).toEqual({ usd: 0.3, source_calls: 1, llm_calls: 1, duration_ms: 0 });
  });

  it("clamps negative costs and rows before createdAt to zero", () => {
    const cost = runCost([{ ts: "2026-10-08T19:00:00.000Z", kind: "llm", cost_usd: -1, ms: -5 }], START);
    expect(cost).toEqual({ usd: 0, source_calls: 0, llm_calls: 0, duration_ms: 0 });
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(0)).toBe("0 s");
    expect(formatDuration(45_900)).toBe("45 s");
    expect(formatDuration(192_000)).toBe("3 min 12 s");
    expect(formatDuration(3_900_000)).toBe("1 h 5 min");
    expect(formatDuration(-10)).toBe("0 s");
  });
});
