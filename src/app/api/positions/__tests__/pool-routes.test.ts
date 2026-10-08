/**
 * Tests for the candidate pool routes (add a candidate, start enrichment) and the intake tag position binding body.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/__tests__/pool-routes.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - addCandidateRoute: auth, 400 without profile/CV, 404 for an unmatched position, 201 new / 200 duplicate, funnel input
 * - enrichRoute: bearer -> via api, session -> via start with its organization, error status passthrough, 400 on a bad body
 *
 * Design constraints:
 * - The funnel (@/workflow/intake) and enrichment (@/workflow/enrich) are mocked; the D1 fake only answers the session lookup
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ingest = vi.hoisted(() => vi.fn());
const enrich = vi.hoisted(() => vi.fn());
vi.mock("@/workflow/intake", () => ({ ingestApplication: ingest }));
vi.mock("@/workflow/enrich", () => ({ startEnrichment: enrich, ENRICH_MAX: 20 }));

import { addCandidateRoute, enrichRoute, type PositionsEnv } from "../routes";

const USER = { sessionId: "s1", accountId: "acc-1", email: "r@example.com", name: "R", organizationId: "org-1", organizationName: "Org" };

/** Any session lookup returns USER when `withSession`; everything else is unexpected. */
function env(withSession = false): PositionsEnv {
  const stmt = (q: string) => ({
    bind: () => stmt(q),
    first: () => Promise.resolve(withSession ? { session_id: "s1", account_id: "acc-1", email: USER.email, name: USER.name, organization_id: "org-1", organization_name: "Org" } : null),
  });
  return {
    DB: { prepare: stmt } as unknown as D1Database,
    SOURCES: {} as R2Bucket,
    RESEARCH_RUN: {} as Workflow<{ runId: string }>,
    RUN_BUDGET_USD: "0.5",
    RUN_BUDGET_CALLS: "16",
    RUN_TOKEN: "secret",
  };
}
const post = (body: unknown, auth: Record<string, string> = { Authorization: "Bearer secret" }) =>
  new Request("http://x/api/positions/p1/x", { method: "POST", headers: auth, body: JSON.stringify(body) });

beforeEach(() => {
  ingest.mockReset();
  enrich.mockReset();
});

describe("addCandidateRoute", () => {
  it("is 401 without credentials and never reaches the funnel", async () => {
    const res = await addCandidateRoute(post({ cvText: "cv" }, {}), env(), "p1");
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(ingest).not.toHaveBeenCalled();
  });

  it("is 400 without a LinkedIn URL or CV text", async () => {
    expect((await addCandidateRoute(post({ name: "Ada" }), env(), "p1")).status).toBe(400);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("creates a pooled row: 201, manual source bound to the position, no-store", async () => {
    ingest.mockResolvedValue({ applicationId: "a1", status: "pooled", runId: null, duplicate: false, note: null });
    const res = await addCandidateRoute(post({ name: "Ada", linkedinUrl: "linkedin.com/in/ada" }), env(), "p1");
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ applicationId: "a1", status: "pooled", runId: null, duplicate: false, note: null });
    expect(ingest.mock.calls[0]?.[0]).toMatchObject({ source: "manual", positionId: "p1", name: "Ada", linkedinUrl: "https://www.linkedin.com/in/ada" });
  });

  it("answers 200 for a duplicate and 404 when the funnel says unmatched", async () => {
    ingest.mockResolvedValueOnce({ applicationId: "a1", status: "pooled", runId: null, duplicate: true, note: null });
    expect((await addCandidateRoute(post({ cvText: "cv" }), env(), "p1")).status).toBe(200);
    ingest.mockResolvedValueOnce({ applicationId: "a2", status: "unmatched", runId: null, duplicate: false, note: "unknown position" });
    const res = await addCandidateRoute(post({ cvText: "cv" }), env(), "gone");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "position not found" });
  });
});

describe("enrichRoute", () => {
  const ok = { ok: true, started: [{ applicationId: "a1", runId: "r1" }], skipped: [{ applicationId: "a2", reason: "already started" }] };

  it("is 401 without credentials", async () => {
    expect((await enrichRoute(post({ applicationIds: ["a1"] }, {}), env(), "p1")).status).toBe(401);
    expect(enrich).not.toHaveBeenCalled();
  });

  it("is 400 for an empty, oversized or malformed id list", async () => {
    for (const applicationIds of [[], Array.from({ length: 201 }, (_, i) => `a${String(i)}`), ["bad id"]]) {
      expect((await enrichRoute(post({ applicationIds }), env(), "p1")).status).toBe(400);
    }
    expect(enrich).not.toHaveBeenCalled();
  });

  it("starts with origin api for the bearer", async () => {
    enrich.mockResolvedValue(ok);
    const res = await enrichRoute(post({ applicationIds: ["a1", "a2"] }), env(), "p1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ started: ok.started, skipped: ok.skipped });
    expect(enrich.mock.calls[0]?.[1]).toEqual({ positionId: "p1", applicationIds: ["a1", "a2"], origin: { via: "api" } });
  });

  it("starts with the session's account and organization", async () => {
    enrich.mockResolvedValue(ok);
    const res = await enrichRoute(post({ applicationIds: ["a1"] }, { Cookie: "oldboys_session=tok" }), env(true), "p1");
    expect(res.status).toBe(200);
    expect(enrich.mock.calls[0]?.[1]).toMatchObject({ origin: { via: "start", accountId: "acc-1", organizationId: "org-1" } });
  });

  it("passes through the error status of a refused start", async () => {
    enrich.mockResolvedValueOnce({ ok: false, status: 404, error: "unknown position" });
    const missing = await enrichRoute(post({ applicationIds: ["a1"] }), env(), "gone");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "unknown position" });
    enrich.mockResolvedValueOnce({ ok: false, status: 429, error: "run cap reached: at most 2 more runs this hour" });
    expect((await enrichRoute(post({ applicationIds: ["a1"] }), env(), "p1")).status).toBe(429);
  });
});
