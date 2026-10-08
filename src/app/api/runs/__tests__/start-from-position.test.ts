/**
 * Tests for insertRun: starting a run from a position (specs/positions-start).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/__tests__/start-from-position.test.ts
 * Deps:    vitest, src/app/api/runs/start, src/domain/position
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - Position lookup, bound role and questions_json, 404 without an INSERT
 * - Without positionId the SQL and bound values are the pre-position ones (un-migrated database keeps working)
 *
 * Design constraints:
 * - Fake D1 at the binding boundary only; no Workers runtime
 */
import { describe, expect, it } from "vitest";
import { insertRun } from "@/app/api/runs/start";
import { StartRunBody } from "@/app/api/_lib/run-body";
import { type MustHave, mustHavesToQuestions } from "@/domain/position";

type Call = { sql: string; values: unknown[] };

function fakeDb(positions: Record<string, { id: string; title: string; must_haves_json: string }>) {
  const inserts: Call[] = [];
  const lookups: Call[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            first: () => {
              lookups.push({ sql, values });
              return Promise.resolve(positions[values[0] as string] ?? null);
            },
            run: () => {
              inserts.push({ sql, values });
              return Promise.resolve({ success: true });
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof insertRun>[0];
  return { db, inserts, lookups };
}

const mustHaves: MustHave[] = [
  { id: "mh-1", text: "Ships paid campaigns", title: "Paid", accepted_evidence: ["case study"] },
  { id: "mh-2", text: "Leads a team", accepted_evidence: [] },
];
const pos = (title = "Head of Growth") => ({ id: "p1", title, must_haves_json: JSON.stringify(mustHaves) });
const parse = (b: unknown) => StartRunBody.parse(b);
const base = { id: "run-1", now: new Date("2026-10-09T10:00:00Z"), budgetUsd: 0.5, budgetCalls: 16, via: "api" as const };
const hiring = { goal: "hiring", profileUrl: "https://www.linkedin.com/in/josef-buryan" };

describe("insertRun with a position", () => {
  it("S5: binds position_id, role = title and questions_json from the must-haves", async () => {
    const { db, inserts } = fakeDb({ p1: pos() });
    const out = await insertRun(db, { ...base, body: parse({ ...hiring, positionId: "p1" }) });
    expect(out).toEqual({ ok: true });
    expect(inserts).toHaveLength(1);
    const { sql, values } = inserts[0] ?? { sql: "", values: [] };
    expect(sql).toContain("position_id");
    expect(values).toContain("p1");
    expect(values).toContain("Head of Growth");
    expect(values).toContain(JSON.stringify(mustHavesToQuestions({ must_haves: mustHaves })));
  });

  it("S6: a body role is ignored", async () => {
    const { db, inserts } = fakeDb({ p1: pos() });
    await insertRun(db, { ...base, body: parse({ ...hiring, role: "Something else", positionId: "p1" }) });
    expect(inserts[0]?.values).toContain("Head of Growth");
    expect(inserts[0]?.values).not.toContain("Something else");
  });

  it("S7: unknown position gives 404 and no INSERT", async () => {
    const { db, inserts } = fakeDb({});
    const out = await insertRun(db, { ...base, body: parse({ ...hiring, positionId: "nope" }) });
    expect(out).toEqual({ ok: false, status: 404, error: "unknown position" });
    expect(inserts).toHaveLength(0);
  });

  it("S9: two runs from one position store identical questions_json", async () => {
    const { db, inserts } = fakeDb({ p1: pos() });
    const body = parse({ ...hiring, positionId: "p1" });
    await insertRun(db, { ...base, body });
    await insertRun(db, { ...base, id: "run-2", body });
    const q = (i: number) => inserts[i]?.values.find((v) => typeof v === "string" && v.startsWith("[{"));
    expect(q(0)).toBeDefined();
    expect(q(0)).toBe(q(1));
  });

  it("S10: editing the position later does not change the stored run", async () => {
    const positions = { p1: pos() };
    const { db, inserts } = fakeDb(positions);
    await insertRun(db, { ...base, body: parse({ ...hiring, positionId: "p1" }) });
    const stored = inserts[0]?.values.find((v) => typeof v === "string" && v.startsWith("[{"));
    positions.p1 = { id: "p1", title: "Renamed", must_haves_json: JSON.stringify([{ id: "mh-9", text: "Other", accepted_evidence: [] }]) };
    expect(stored).toBe(JSON.stringify(mustHavesToQuestions({ must_haves: mustHaves })));
  });

  it("S12: questions_json is a non-empty array, so the Workflow's questions_json === null guard is false", async () => {
    const { db, inserts } = fakeDb({ p1: pos() });
    await insertRun(db, { ...base, body: parse({ ...hiring, positionId: "p1" }) });
    const stored = inserts[0]?.values.find((v) => typeof v === "string" && v.startsWith("[{"));
    const parsed: unknown = JSON.parse(String(stored));
    expect(Array.isArray(parsed) && parsed.length > 0).toBe(true);
  });

  it("a position with no must-haves still stores an array, never null (the Workflow would otherwise generate questions from the title)", async () => {
    const { db, inserts } = fakeDb({ p1: { id: "p1", title: "Analyst", must_haves_json: "[]" } });
    await insertRun(db, { ...base, body: parse({ ...hiring, positionId: "p1" }) });
    expect(inserts[0]?.values).toContain("[]");
  });

  it("an unreadable must_haves_json is an unknown position, not a crash", async () => {
    const { db, inserts } = fakeDb({ p1: { id: "p1", title: "Analyst", must_haves_json: "{not json" } });
    const out = await insertRun(db, { ...base, body: parse({ ...hiring, positionId: "p1" }) });
    expect(out).toMatchObject({ ok: false, status: 404 });
    expect(inserts).toHaveLength(0);
  });
});

describe("insertRun without a position", () => {
  it("S8: SQL names no position_id and binds exactly the pre-position values", async () => {
    const { db, inserts, lookups } = fakeDb({});
    const body = parse({ ...hiring, role: "CMO", sourceUrl: "https://www.linkedin.com/in/josef-buryan" });
    await insertRun(db, { ...base, body });
    expect(lookups).toHaveLength(0);
    expect(inserts[0]?.sql).not.toContain("position_id");
    expect(inserts[0]?.sql).not.toContain("questions_json");
    expect(inserts[0]?.values).toEqual([
      "run-1", "", "", "hiring", 0.5, 16, "2026-10-09T10:00:00.000Z",
      "https://www.linkedin.com/in/josef-buryan", "CMO", "api", "https://www.linkedin.com/in/josef-buryan", null,
    ]);
  });
});
