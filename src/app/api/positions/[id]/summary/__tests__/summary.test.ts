/**
 * Tests for the public position summary loader and route function with a hand-written D1 fake.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/[id]/summary/__tests__/summary.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Shape: only id, title and must-haves {id, title?, text}; no accepted_evidence, company, posting or excerpt
 * - Unknown id, over-long id and a malformed must_haves_json: null or empty list, never a throw
 * - Route function: 200 without a token, 404 for unknown, no-store on both
 *
 * Design constraints:
 * - No module mocks; the fake records the SQL it was given
 */
import { describe, expect, it } from "vitest";
import { getPositionSummary, getPositionSummaryRoute } from "../summary";

type Row = Record<string, unknown>;

function makeDb(rows: Row[]) {
  const seen: string[] = [];
  const db = {
    prepare(sql: string) {
      seen.push(sql);
      return {
        bind: (id: unknown) => ({ first: () => Promise.resolve(rows.find((r) => r.id === id) ?? null) }),
      };
    },
  } as unknown as D1Database;
  return { db, seen };
}

const stored = (over: Row = {}): Row => ({
  id: "pos-1",
  title: "Senior Data Engineer",
  must_haves_json: JSON.stringify([
    { id: "mh-a", title: "Pipelines", text: "Has shipped batch pipelines", accepted_evidence: ["repo", "talk"] },
    { id: "mh-b", text: "Writes SQL daily", accepted_evidence: [] },
  ]),
  ...over,
});

describe("getPositionSummary", () => {
  it("returns id, title and must-haves without accepted_evidence", async () => {
    const { db } = makeDb([stored()]);
    expect(await getPositionSummary(db, "pos-1")).toEqual({
      id: "pos-1",
      title: "Senior Data Engineer",
      must_haves: [
        { id: "mh-a", title: "Pipelines", text: "Has shipped batch pipelines" },
        { id: "mh-b", text: "Writes SQL daily" },
      ],
    });
  });

  it("selects only the three columns it exposes", async () => {
    const { db, seen } = makeDb([stored()]);
    await getPositionSummary(db, "pos-1");
    expect(seen).toEqual(["SELECT id, title, must_haves_json FROM positions WHERE id = ?"]);
  });

  it("returns null for an unknown id and for an id over 64 characters, without querying the long one", async () => {
    const { db, seen } = makeDb([stored()]);
    expect(await getPositionSummary(db, "nope")).toBeNull();
    expect(await getPositionSummary(db, "x".repeat(65))).toBeNull();
    expect(seen).toHaveLength(1);
  });

  it("returns an empty must-have list when the stored JSON no longer parses", async () => {
    const { db } = makeDb([stored({ must_haves_json: "{oops" })]);
    expect(await getPositionSummary(db, "pos-1")).toEqual({ id: "pos-1", title: "Senior Data Engineer", must_haves: [] });
  });
});

describe("getPositionSummaryRoute", () => {
  it("answers 200 with no Authorization header and a no-store cache header", async () => {
    const { db } = makeDb([stored()]);
    const res = await getPositionSummaryRoute(db, "pos-1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await res.json<{ id: string }>()).id).toBe("pos-1");
  });

  it("answers 404 for an unknown position", async () => {
    const { db } = makeDb([]);
    const res = await getPositionSummaryRoute(db, "pos-1");
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
