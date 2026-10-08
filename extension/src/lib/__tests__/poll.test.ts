/**
 * Tests for the polling decisions: due runs, transitions, badge.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/src/lib/__tests__/poll.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Only non-terminal runs are polled
 * - running→paused, →done and →failed notify; queued→running and unchanged status do not
 * - Badge counts paused runs and unopened done runs
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { type RunStatus } from "@domain/run-status";
import { applyStatus, badgeText, dueRuns, transition, type TrackedRun } from "../poll";

const run: TrackedRun = {
  runId: "r1",
  subject: "Jan Novák",
  goal: "hiring",
  sourceUrl: "https://www.linkedin.com/in/jan",
  status: "running",
  facts: 0,
  inferences: 0,
  gaps: 0,
  candidates: 0,
  opened: false,
  startedAt: "2026-10-08T20:00:00.000Z",
  checkedAt: null,
};

const status = (overrides: Partial<RunStatus>): RunStatus => ({
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

describe("dueRuns", () => {
  it("keeps queued, running and paused; drops done and failed", () => {
    const runs = (["queued", "running", "paused", "done", "failed"] as const).map((s, i) => ({ ...run, runId: String(i), status: s }));
    expect(dueRuns(runs).map((r) => r.status)).toEqual(["queued", "running", "paused"]);
  });
});

describe("transition", () => {
  it("is silent when nothing changed or when a run starts running", () => {
    expect(transition("running", status({}))).toBeNull();
    expect(transition("queued", status({}))).toBeNull();
  });

  it("asks the user to pick when paused", () => {
    const candidate = { id: "c1", name: "Jan Novák", anchor_match: null, score: 0.5, decision: "possibly-same-as" as const };
    expect(transition("running", status({ status: "paused", needsAnswer: [candidate, candidate] }))).toEqual({
      title: "Jan Novák: pick the right person",
      message: "2 candidates found. Click to choose.",
    });
  });

  it("reports counts when done and a failure when failed", () => {
    expect(transition("running", status({ status: "done", facts: 11, inferences: 3, gaps: 2 }))).toEqual({
      title: "Jan Novák: profile complete",
      message: "11 facts, 3 inferences, 2 gaps. Click to open.",
    });
    expect(transition("running", status({ status: "failed" }))?.title).toBe("Jan Novák: research failed");
  });
});

describe("applyStatus and badgeText", () => {
  it("copies counts and stamps checkedAt", () => {
    const next = applyStatus(run, status({ status: "done", facts: 2, gaps: 1 }), new Date("2026-10-08T21:00:00.000Z"));
    expect(next).toMatchObject({ status: "done", facts: 2, gaps: 1, checkedAt: "2026-10-08T21:00:00.000Z" });
  });

  it("counts paused and unopened done runs only", () => {
    expect(badgeText([])).toBe("");
    expect(
      badgeText([
        { ...run, status: "paused" },
        { ...run, runId: "r2", status: "done" },
        { ...run, runId: "r3", status: "done", opened: true },
        { ...run, runId: "r4", status: "running" },
      ]),
    ).toBe("2");
  });
});
