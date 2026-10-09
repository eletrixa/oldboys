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
 * - code_profile is the github_deep ledger row's `ref.digest` when valid, null for older runs
 *
 * Design constraints:
 * - Only the Workers binding (getCloudflareContext + D1) is faked
 */
import { describe, expect, it, vi } from "vitest";

let head: Record<string, unknown> | null = null;
let ledger: Record<string, unknown>[] = [];

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: {
      DB: {
        prepare: (sql: string) => ({
          bind: () => ({
            first: () => Promise.resolve(sql.includes("FROM investigations") ? head : null),
            all: () => Promise.resolve({ results: sql.includes("FROM ledger_entries") ? ledger : [] }),
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

describe("GET /api/runs/:id/state code_profile", () => {
  const digest = {
    handle: "jnovak", profile_url: "https://github.com/jnovak", repos_owned: 1, forks_excluded: 0,
    stats_pending: [], repos: [], languages: [], stars_received: 0,
    merged_prs_elsewhere: 0, merged_prs_sample: [], recent_events: { pushes: 0, pull_requests: 0, issues: 0, reviews: 0, since: null },
    orgs: [], account_created: null, sources: { user: "https://api.github.com/users/jnovak", repos: "https://api.github.com/users/jnovak/repos", search: "https://api.github.com/search/issues", events: "https://api.github.com/users/jnovak/events/public", orgs: "https://api.github.com/users/jnovak/orgs" },
  };

  it("returns the digest of the github_deep step", async () => {
    head = row({});
    ledger = [{ step: "github_deep", ts: "2026-10-09T10:01:00.000Z", kind: "step", cost_usd: 0, ms: 5, ref_json: JSON.stringify({ digest }) }];
    expect((await get()).code_profile).toEqual({ ...digest, apify: null });
  });

  it("returns null for an older run or a malformed digest", async () => {
    head = row({});
    ledger = [{ step: "serp", ts: "2026-10-09T10:01:00.000Z", kind: "step", cost_usd: 0, ms: 5, ref_json: null }];
    expect((await get()).code_profile).toBeNull();
    ledger = [{ step: "github_deep", ts: "2026-10-09T10:01:00.000Z", kind: "step", cost_usd: 0, ms: 5, ref_json: JSON.stringify({ digest: { handle: "x" } }) }];
    expect((await get()).code_profile).toBeNull();
  });
});
