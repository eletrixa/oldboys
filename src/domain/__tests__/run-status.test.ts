/**
 * Tests for the RunStatus projection and the mark-dedupe window.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/run-status.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Claim counts land in the right buckets and missing kinds read as zero
 * - needsAnswer is present only while paused
 * - dedupeSince is exactly 24 h before now
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { dedupeSince, isStalled, toRunStatus, type InvestigationHead } from "@/domain/run-status";

const head: InvestigationHead = {
  id: "run-1",
  subject: "Jane Doe",
  goal: "hiring",
  status: "running",
  created_at: "2026-10-08T20:00:00.000Z",
};

describe("toRunStatus", () => {
  it("buckets claim counts by kind and defaults missing kinds to zero", () => {
    const status = toRunStatus(head, [{ kind: "FACT", n: 3 }, { kind: "STATEMENT", n: 1 }], 2, []);
    expect(status).toMatchObject({ facts: 3, inferences: 0, statements: 1, gaps: 2, needsAnswer: null });
  });

  it("exposes candidates only while paused", () => {
    const candidate = { id: "c1", name: "Jane Doe", anchor_match: "Prague", score: 0.6, decision: "possibly-same-as" as const };
    expect(toRunStatus({ ...head, status: "paused" }, [], 0, [candidate]).needsAnswer).toEqual([candidate]);
    expect(toRunStatus({ ...head, status: "done" }, [], 0, [candidate]).needsAnswer).toBeNull();
  });
});

describe("dedupeSince", () => {
  it("is 24 hours before now", () => {
    expect(dedupeSince(new Date("2026-10-08T20:00:00.000Z"))).toBe("2026-10-07T20:00:00.000Z");
  });
});

describe("isStalled", () => {
  const last = "2026-10-09T10:00:00.000Z";
  it("is true only for running or queued past the limit", () => {
    expect(isStalled("running", last, "2026-10-09T10:31:00.000Z")).toBe(true);
    expect(isStalled("queued", last, "2026-10-09T10:31:00.000Z")).toBe(true);
    expect(isStalled("running", last, "2026-10-09T10:30:00.000Z")).toBe(false);
    expect(isStalled("paused", last, "2026-10-09T18:00:00.000Z")).toBe(false);
    expect(isStalled("done", last, "2026-10-09T18:00:00.000Z")).toBe(false);
    expect(isStalled("running", last, "2026-10-09T10:05:00.000Z", 3)).toBe(true);
  });
  it("is false for an unparseable timestamp", () => {
    expect(isStalled("running", "nope", last)).toBe(false);
  });
});
