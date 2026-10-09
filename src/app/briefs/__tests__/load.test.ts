/**
 * Tests for the briefs grouping and status labels.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/__tests__/load.test.ts
 * Deps:    vitest, ../load
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Groups in newest-run order with "No position" last; rows keep their order; status labels
 *
 * Design constraints:
 * - No D1: only the pure helpers
 */
import { describe, expect, it } from "vitest";
import { type BriefRow, groupByPosition, statusOf } from "../load";

const row = (id: string, position_id: string | null, over: Partial<BriefRow> = {}): BriefRow => ({
  id, subject: id, role: null, status: "done", created_at: "2026-10-09T10:00:00.000Z", started_by: null,
  position_id, position_title: position_id === null ? null : `Title ${position_id}`, fit_pct: null, last_at: "2026-10-09T10:00:00.000Z", ...over,
});

describe("groupByPosition", () => {
  it("groups by position in newest-run order, No position last", () => {
    const groups = groupByPosition([row("r1", null), row("r2", "p2"), row("r3", "p1"), row("r4", "p2")]);
    expect(groups.map((g) => [g.title, g.rows.map((r) => r.id)])).toEqual([
      ["Title p2", ["r2", "r4"]],
      ["Title p1", ["r3"]],
      ["No position", ["r1"]],
    ]);
  });

  it("is empty for no rows", () => {
    expect(groupByPosition([])).toEqual([]);
  });
});

describe("statusOf", () => {
  it("labels run statuses", () => {
    expect(statusOf("done")).toEqual({ label: "Done", tone: "ok" });
    expect(statusOf("failed").tone).toBe("conflict");
    expect(statusOf("running").label).toBe("Researching");
    expect(statusOf("queued").label).toBe("Researching");
    expect(statusOf("running", "2026-10-09T10:00:00.000Z", "2026-10-09T10:29:00.000Z").label).toBe("Researching");
    expect(statusOf("running", "2026-10-09T10:00:00.000Z", "2026-10-09T10:31:00.000Z").label).toBe("Stalled, start again");
    expect(statusOf("done", "2026-10-09T10:00:00.000Z", "2026-10-09T12:00:00.000Z").label).toBe("Done");
  });
});
