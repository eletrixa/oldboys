/**
 * Tests for starting a run from a position: loadPositionQuestions + startRun (specs/positions-start).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/start-from-position.test.ts
 * Deps:    vitest, src/workflow/start-run, src/domain/position
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - Position lookup, bound role and questions_json, null (404 for the route) without an INSERT
 * - Without a position the INSERT binds position_id and questions_json as NULL
 *
 * Design constraints:
 * - Fake D1 at the binding boundary only; no Workers runtime
 */
import { describe, expect, it, vi } from "vitest";
import { type MustHave, mustHavesToQuestions } from "@/domain/position";
import { loadPositionQuestions, type StartRunEnv, startRun } from "@/workflow/start-run";

type Call = { sql: string; values: unknown[] };

function fakeEnv(positions: Record<string, { title: string; must_haves_json: string }>) {
  const inserts: Call[] = [];
  const lookups: Call[] = [];
  const DB = {
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
  };
  const create = vi.fn((_: unknown) => Promise.resolve({ id: "x" }));
  const env = { DB, RESEARCH_RUN: { create }, RUN_BUDGET_USD: "0.5", RUN_BUDGET_CALLS: "16" } as unknown as StartRunEnv;
  return { env, inserts, lookups, create };
}

const mustHaves: MustHave[] = [
  { id: "mh-1", text: "Ships paid campaigns", title: "Paid", accepted_evidence: ["case study"] },
  { id: "mh-2", text: "Leads a team", accepted_evidence: [] },
];
const pos = (title = "Head of Growth") => ({ title, must_haves_json: JSON.stringify(mustHaves) });
const NOW = new Date("2026-10-09T10:00:00Z");
const hiring = { goal: "hiring" as const, profileUrl: "https://www.linkedin.com/in/josef-buryan", via: "api" as const };
const expectedQuestions = JSON.stringify(mustHavesToQuestions({ must_haves: mustHaves }));

async function startFrom(env: StartRunEnv, positionId: string, role?: string) {
  const position = await loadPositionQuestions(env.DB, positionId);
  if (position === null) return null;
  return startRun(env, { ...hiring, role, position }, NOW);
}

describe("startRun with a position", () => {
  it("S5: binds position_id, role = title and questions_json from the must-haves", async () => {
    const { env, inserts } = fakeEnv({ p1: pos() });
    const out = await startFrom(env, "p1");
    expect(out).not.toBeNull();
    expect(inserts).toHaveLength(1);
    const { sql, values } = inserts[0] ?? { sql: "", values: [] };
    expect(sql).toContain("position_id, questions_json");
    expect(values.slice(-2)).toEqual(["p1", expectedQuestions]);
    expect(values).toContain("Head of Growth");
  });

  it("S6: a body role is ignored", async () => {
    const { env, inserts } = fakeEnv({ p1: pos() });
    await startFrom(env, "p1", "Something else");
    expect(inserts[0]?.values).toContain("Head of Growth");
    expect(inserts[0]?.values).not.toContain("Something else");
  });

  it("S7: unknown position gives null and no INSERT", async () => {
    const { env, inserts } = fakeEnv({});
    expect(await startFrom(env, "nope")).toBeNull();
    expect(inserts).toHaveLength(0);
  });

  it("S9: two runs from one position store identical questions_json", async () => {
    const { env, inserts } = fakeEnv({ p1: pos() });
    await startFrom(env, "p1");
    await startFrom(env, "p1");
    expect(inserts[0]?.values.at(-1)).toBe(expectedQuestions);
    expect(inserts[1]?.values.at(-1)).toBe(expectedQuestions);
  });

  it("S10: editing the position later does not change the stored run", async () => {
    const positions = { p1: pos() };
    const { env, inserts } = fakeEnv(positions);
    await startFrom(env, "p1");
    positions.p1 = { title: "Renamed", must_haves_json: JSON.stringify([{ id: "mh-9", text: "Other", accepted_evidence: [] }]) };
    expect(inserts[0]?.values.at(-1)).toBe(expectedQuestions);
  });

  it("S12: questions_json is a non-empty array, so the Workflow's questions_json === null guard is false", async () => {
    const { env, inserts } = fakeEnv({ p1: pos() });
    await startFrom(env, "p1");
    const parsed: unknown = JSON.parse(String(inserts[0]?.values.at(-1)));
    expect(Array.isArray(parsed) && parsed.length > 0).toBe(true);
  });

  it("a position with no must-haves still stores an array, never null", async () => {
    const { env, inserts } = fakeEnv({ p1: { title: "Analyst", must_haves_json: "[]" } });
    await startFrom(env, "p1");
    expect(inserts[0]?.values.at(-1)).toBe("[]");
  });

  it("an unreadable must_haves_json is an unknown position, not a crash", async () => {
    const { env, inserts } = fakeEnv({ p1: { title: "Analyst", must_haves_json: "{not json" } });
    expect(await startFrom(env, "p1")).toBeNull();
    expect(inserts).toHaveLength(0);
  });
});

describe("startRun without a position", () => {
  it("S8: binds position_id and questions_json as NULL and keeps the body role", async () => {
    const { env, inserts, lookups } = fakeEnv({});
    await startRun(env, { ...hiring, role: "CMO", sourceUrl: "https://www.linkedin.com/in/josef-buryan" }, NOW);
    expect(lookups).toHaveLength(0);
    expect(inserts[0]?.values.slice(-2)).toEqual([null, null]);
    expect(inserts[0]?.values).toContain("CMO");
  });
});
