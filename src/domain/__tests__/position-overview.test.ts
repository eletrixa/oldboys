/**
 * Tests for the per-position candidates overview.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/position-overview.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - B11: null for no rows; one group keyed by position id, labelled with the position title, runs newest first
 * - B12: a run without a brief is "not checked" in every cell
 * - Rows with a legacy free-text role are still one group, role text ignored
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { positionOverview } from "@/domain/position-overview";
import type { RoleRunRow } from "@/domain/role-overview";

const Q_TS = { id: "mh-ts", text: "Has shipped TypeScript in production" };
const Q_LEAD = { id: "mh-lead", text: "Has led a team" };
const POSITION = { id: "pos-1", title: "Staff Engineer" };

function brief(cov: Record<string, string>): string {
  return JSON.stringify({
    run_id: "x",
    per_question: Object.entries(cov).map(([question_id, coverage]) => ({ question_id, coverage, claim_ids: [], summary: "" })),
    degraded: null,
  });
}

function row(over: Partial<RoleRunRow>): RoleRunRow {
  return {
    id: "r1",
    subject: "Jana Nováková",
    role: "senior typescript developer",
    status: "done",
    created_at: "2026-10-08T20:00:00.000Z",
    questions_json: JSON.stringify([Q_TS, Q_LEAD]),
    brief_json: brief({ "mh-ts": "evidenced", "mh-lead": "partial" }),
    sources_confirmed: 2,
    ...over,
  };
}

describe("positionOverview", () => {
  it("B11: returns null for no rows", () => {
    expect(positionOverview([], POSITION)).toBeNull();
  });

  it("B11: one group keyed by position id, titled by the position, runs newest first with brief labels", () => {
    const group = positionOverview(
      [
        row({ id: "old", created_at: "2026-10-07T10:00:00.000Z", brief_json: brief({ "mh-ts": "none", "mh-lead": "none" }) }),
        row({ id: "new" }),
      ],
      POSITION,
    );
    expect(group?.key).toBe("pos-1");
    expect(group?.role).toBe("Staff Engineer");
    expect(group?.run_count).toBe(2);
    expect(group?.questions).toEqual([Q_TS.text, Q_LEAD.text]);
    expect(group?.runs.map((r) => r.id)).toEqual(["new", "old"]);
    expect(group?.runs[0]?.cells).toEqual(["documented", "partial"]);
    expect(group?.runs[1]?.cells).toEqual(["no evidence", "no evidence"]);
  });

  it("B12: a run without a brief is not checked in every cell", () => {
    const group = positionOverview([row({ brief_json: null })], POSITION);
    expect(group?.runs[0]?.cells).toEqual(["not checked", "not checked"]);
  });

  it("groups legacy rows with different or missing role text into the one position group", () => {
    const group = positionOverview([row({ id: "a", role: "Dev" }), row({ id: "b", role: null })], POSITION);
    expect(group?.run_count).toBe(2);
    expect(group?.role).toBe("Staff Engineer");
  });
});
