/**
 * Tests for GET /api/runs/:id/state: the position field (specs/positions-start S11).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/state/__tests__/route.test.ts
 * Deps:    vitest, src/app/api/runs/[id]/state/route
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - position is { id, title } for a run with a live position, null without one or after a purge
 * - Pre-existing keys stay present
 *
 * Design constraints:
 * - Only the Workers binding (getCloudflareContext + D1) is faked
 */
import { describe, expect, it, vi } from "vitest";

let head: Record<string, unknown> | null = null;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: {
      DB: {
        prepare: (sql: string) => ({
          bind: () => ({
            first: () => Promise.resolve(sql.includes("FROM investigations") ? head : null),
            all: () => Promise.resolve({ results: [] }),
          }),
        }),
      },
    },
  }),
}));

const { GET } = await import("../route");

const row = (over: Record<string, unknown>) => ({
  id: "r1", subject: "Jan Novak", goal: "hiring", role: "Head of Growth", status: "running", questions_json: null,
  created_at: "2026-10-09T10:00:00.000Z", position_id: null, position_title: null, ...over,
});
const get = async (): Promise<Record<string, unknown>> =>
  (await GET(new Request("http://x/api/runs/r1/state"), { params: Promise.resolve({ id: "r1" }) })).json();

describe("GET /api/runs/:id/state position", () => {
  it("returns { id, title } for a run started from a position", async () => {
    head = row({ position_id: "p1", position_title: "Head of Growth" });
    const state = await get();
    expect(state.position).toEqual({ id: "p1", title: "Head of Growth" });
    for (const key of ["id", "subject", "role", "status", "questions", "claims", "cost", "step_count"]) expect(state).toHaveProperty(key);
  });

  it("returns null without a position or when it was purged", async () => {
    head = row({});
    expect((await get()).position).toBeNull();
  });
});
