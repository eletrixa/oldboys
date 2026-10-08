/**
 * Tests for the candidates-per-role overview builder.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/role-overview.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Grouping by trimmed, case-insensitive role text; empty roles skipped
 * - Question columns are the union of mh- questions matched by text; base questions ignored
 * - Coverage labels; "not checked" for missing, degraded or malformed briefs and questions a run did not have
 * - Runs newest first regardless of coverage; no score field anywhere
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { roleKey, roleOverview, type RoleRunRow } from "@/domain/role-overview";

const Q_TS = { id: "mh-ts", text: "Has shipped TypeScript in production" };
const Q_LEAD = { id: "mh-lead", text: "Has led a team" };
const BASE = { id: "work", text: "Where do they work?" };

function brief(cov: Record<string, string>, degraded: string | null = null): string {
  return JSON.stringify({
    run_id: "x",
    per_question: Object.entries(cov).map(([question_id, coverage]) => ({ question_id, coverage, claim_ids: [], summary: "" })),
    degraded,
  });
}

function row(over: Partial<RoleRunRow>): RoleRunRow {
  return {
    id: "r1",
    subject: "Jana Nováková",
    role: "Senior TypeScript developer",
    status: "done",
    created_at: "2026-10-08T20:00:00.000Z",
    questions_json: JSON.stringify([BASE, Q_TS, Q_LEAD]),
    brief_json: brief({ "mh-ts": "evidenced", "mh-lead": "none", work: "evidenced" }),
    sources_confirmed: 3,
    ...over,
  };
}

describe("roleKey", () => {
  it("trims, collapses whitespace and ignores case", () => {
    expect(roleKey("  Senior   TypeScript Developer ")).toBe("senior typescript developer");
  });
});

describe("roleOverview", () => {
  it("groups runs by normalized role and skips runs without a role", () => {
    const groups = roleOverview([
      row({ id: "a" }),
      row({ id: "b", role: " senior typescript DEVELOPER " }),
      row({ id: "c", role: "Data engineer" }),
      row({ id: "d", role: null }),
      row({ id: "e", role: "   " }),
    ]);
    expect(groups.map((g) => [g.key, g.run_count])).toEqual([
      ["senior typescript developer", 2],
      ["data engineer", 1],
    ]);
  });

  it("maps brief coverage to labels for mh- questions only", () => {
    const [group] = roleOverview([row({ brief_json: brief({ "mh-ts": "evidenced", "mh-lead": "partial" }) })]);
    expect(group?.questions).toEqual([Q_TS.text, Q_LEAD.text]);
    expect(group?.runs[0]?.cells).toEqual(["documented", "partial"]);
    expect(group?.runs[0]?.sources_confirmed).toBe(3);
  });

  it("labels none as no evidence and unknown ids as not checked", () => {
    const [group] = roleOverview([row({ brief_json: brief({ "mh-ts": "none" }) })]);
    expect(group?.runs[0]?.cells).toEqual(["no evidence", "not checked"]);
  });

  it("marks every cell not checked when the brief is missing, degraded or malformed", () => {
    const [group] = roleOverview([
      row({ id: "missing", brief_json: null, created_at: "2026-10-08T21:00:00.000Z" }),
      row({ id: "degraded", brief_json: brief({ "mh-ts": "evidenced" }, "model unavailable"), created_at: "2026-10-08T20:30:00.000Z" }),
      row({ id: "broken", brief_json: "{oops", created_at: "2026-10-08T20:00:00.000Z" }),
    ]);
    expect(group?.runs.map((r) => r.cells)).toEqual([
      ["not checked", "not checked"],
      ["not checked", "not checked"],
      ["not checked", "not checked"],
    ]);
  });

  it("unions questions across runs by text, even when ids differ", () => {
    const other = { id: "mh-team-lead", text: "  has led a TEAM " };
    const extra = { id: "mh-oss", text: "Maintains open source" };
    const [group] = roleOverview([
      row({ id: "old", created_at: "2026-10-07T10:00:00.000Z" }),
      row({
        id: "new",
        questions_json: JSON.stringify([other, extra]),
        brief_json: brief({ "mh-team-lead": "evidenced", "mh-oss": "partial" }),
      }),
    ]);
    expect(group?.questions).toEqual(["has led a TEAM", extra.text, Q_TS.text]);
    expect(group?.runs.map((r) => [r.id, r.cells])).toEqual([
      ["new", ["documented", "partial", "not checked"]],
      ["old", ["no evidence", "not checked", "documented"]],
    ]);
  });

  it("orders runs newest first, never by coverage, and exposes no score", () => {
    const [group] = roleOverview([
      row({ id: "rich", created_at: "2026-10-01T10:00:00.000Z", sources_confirmed: 20 }),
      row({ id: "poor", created_at: "2026-10-08T10:00:00.000Z", brief_json: brief({ "mh-ts": "none", "mh-lead": "none" }), sources_confirmed: 0 }),
    ]);
    expect(group?.runs.map((r) => r.id)).toEqual(["poor", "rich"]);
    expect(Object.keys(group?.runs[0] ?? {})).not.toContain("score");
  });

  it("orders groups by their most recent run and takes the latest role spelling", () => {
    const groups = roleOverview([
      row({ id: "a", role: "Data engineer", created_at: "2026-10-01T10:00:00.000Z" }),
      row({ id: "b", role: "DATA ENGINEER", created_at: "2026-10-02T10:00:00.000Z" }),
      row({ id: "c", role: "Designer", created_at: "2026-10-08T10:00:00.000Z" }),
    ]);
    expect(groups.map((g) => g.role)).toEqual(["Designer", "DATA ENGINEER"]);
  });

  it("treats malformed questions JSON as no columns", () => {
    const [group] = roleOverview([row({ questions_json: "nope" })]);
    expect(group?.questions).toEqual([]);
    expect(group?.runs[0]?.cells).toEqual([]);
  });
});
