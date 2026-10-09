/**
 * Tests for POST /api/runs/:id/delete (deleteRunRoute) with a small D1 fake, a Workflow fake and an injected delete.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/delete/__tests__/handler.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Auth: session (same-origin required), bearer, none (401), unset RUN_TOKEN (503), cross-origin session (403)
 * - Organization mismatch 403, unknown run 404, bad reason 400, live call 409, unstoppable Workflow 502
 * - Workflows are terminated for running/paused runs and approved calls; missing instances are ignored
 * - The receipt has run id, time, reason and counts only
 *
 * Design constraints:
 * - No module mocks; the session lookup runs for real against the fake's session query
 */
import { describe, expect, it } from "vitest";
import type { CallRow, DeletionCounts } from "@/domain/deletion";
import { hashSessionToken, newSessionToken } from "@/domain/session";
import { deleteRunRoute, type DeleteRunDeps, type DeleteRunEnv } from "../handler";

const NOW = new Date("2026-10-09T01:45:00.000Z");
const COUNTS: DeletionCounts = {
  sources: 23, claims: 14, candidates: 2, gaps: 3, briefs: 1, calls: 1, ledger_entries: 40, applications: 1, webhook_events: 1, cv_files: 1, r2_objects: 25,
};

type Run = { id: string; organization_id: string | null };
type Setup = { runs?: Run[]; calls?: CallRow[]; instances?: Record<string, InstanceStatus["status"]>; getError?: Error };

async function setup(opts: Setup = {}) {
  const token = newSessionToken();
  const hash = await hashSessionToken(token);
  const sessionRow = { session_id: "s1", account_id: "a1", email: "hr@x.test", name: "HR", organization_id: "org-1", organization_name: "Acme" };
  const runs = [...(opts.runs ?? [{ id: "run-1", organization_id: "org-1" }])];
  const calls = opts.calls ?? [];
  const instances = { ...(opts.instances ?? {}) };
  const terminated: string[] = [];
  const deleted: string[] = [];

  const DB = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: () => {
          if (sql.startsWith("SELECT s.id AS session_id")) return Promise.resolve(args[0] === hash ? sessionRow : null);
          if (sql.startsWith("SELECT id, organization_id FROM investigations")) return Promise.resolve(runs.find((r) => r.id === args[0]) ?? null);
          throw new Error(`unexpected SQL: ${sql}`);
        },
        all: () => {
          if (sql.startsWith("SELECT id, status, provider, approved_at FROM calls")) return Promise.resolve({ results: calls });
          throw new Error(`unexpected SQL: ${sql}`);
        },
      }),
    }),
  } as unknown as D1Database;

  const workflows = {
    get: (id: string) => {
      if (opts.getError) return Promise.reject(opts.getError);
      const status = instances[id];
      if (status === undefined) return Promise.reject(new Error("instance.not_found"));
      return Promise.resolve({
        status: () => Promise.resolve({ status: instances[id] }),
        terminate: () => {
          terminated.push(id);
          instances[id] = "terminated";
          return Promise.resolve();
        },
        delete: () => Promise.resolve(),
      } as unknown as WorkflowInstance);
    },
  };

  const env: DeleteRunEnv = { DB, SOURCES: {} as R2Bucket, RESEARCH_RUN: workflows, VERIFY_CALL: workflows, RUN_TOKEN: "secret" };
  const deps: DeleteRunDeps = {
    now: () => NOW,
    deleteRun: (_db, _bucket, runId) => {
      deleted.push(runId);
      const i = runs.findIndex((r) => r.id === runId);
      if (i >= 0) runs.splice(i, 1);
      return Promise.resolve(COUNTS);
    },
  };
  return { env, deps, token, terminated, deleted };
}

const SAME_ORIGIN = { "Sec-Fetch-Site": "same-origin", Origin: "https://oldboys.test", Host: "oldboys.test" };

function req(headers: Record<string, string>, body: unknown = { reason: "rejected" }): Request {
  return new Request("https://oldboys.test/api/runs/run-1/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const browser = (token: string, body?: unknown) => req({ ...SAME_ORIGIN, Cookie: `oldboys_session=${token}` }, body);
const bearer = (body?: unknown) => req({ Authorization: "Bearer secret" }, body);

describe("deleteRunRoute: auth", () => {
  it("deletes for a logged-in recruiter of the run's organization and returns a receipt without personal data", async () => {
    const s = await setup();

    const res = await deleteRunRoute(browser(s.token), s.env, "run-1", s.deps);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ run_id: "run-1", deleted_at: "2026-10-09T01:45:00.000Z", reason: "rejected", counts: COUNTS });
    expect(s.deleted).toEqual(["run-1"]);
  });

  it("accepts the bearer for scripts without any origin headers and without an organization check", async () => {
    const s = await setup({ runs: [{ id: "run-1", organization_id: "org-other" }] });
    const res = await deleteRunRoute(bearer({ reason: "candidate-request" }), s.env, "run-1", s.deps);
    expect(res.status).toBe(200);
    expect((await res.json<{ reason: string }>()).reason).toBe("candidate-request");
  });

  it("answers 401 without session or bearer, 401 for a wrong bearer and 503 when RUN_TOKEN is unset", async () => {
    const s = await setup();
    expect((await deleteRunRoute(req(SAME_ORIGIN), s.env, "run-1", s.deps)).status).toBe(401);
    expect((await deleteRunRoute(req({ Authorization: "Bearer nope" }), s.env, "run-1", s.deps)).status).toBe(401);
    expect((await deleteRunRoute(bearer(), { ...s.env, RUN_TOKEN: "" }, "run-1", s.deps)).status).toBe(503);
    expect(s.deleted).toEqual([]);
  });

  it("answers 403 for a session request from another site", async () => {
    const s = await setup();
    const res = await deleteRunRoute(req({ "Sec-Fetch-Site": "cross-site", Cookie: `oldboys_session=${s.token}` }), s.env, "run-1", s.deps);
    expect(res.status).toBe(403);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(s.deleted).toEqual([]);
  });

  it("answers 403 when the run belongs to another organization, and lets any recruiter delete a run without one", async () => {
    const s = await setup({ runs: [{ id: "run-1", organization_id: "org-other" }, { id: "run-2", organization_id: null }] });
    const denied = await deleteRunRoute(browser(s.token), s.env, "run-1", s.deps);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: "this run belongs to another organization" });
    expect((await deleteRunRoute(browser(s.token), s.env, "run-2", s.deps)).status).toBe(200);
    expect(s.deleted).toEqual(["run-2"]);
  });
});

describe("deleteRunRoute: request and run", () => {
  it("answers 400 for a missing or unknown reason and for a non-JSON body", async () => {
    const s = await setup();
    expect((await deleteRunRoute(bearer({}), s.env, "run-1", s.deps)).status).toBe(400);
    expect((await deleteRunRoute(bearer({ reason: "bad fit" }), s.env, "run-1", s.deps)).status).toBe(400);
    expect((await deleteRunRoute(bearer("not json"), s.env, "run-1", s.deps)).status).toBe(400);
    expect(s.deleted).toEqual([]);
  });

  it("answers 404 for an unknown run and for a second delete of the same run", async () => {
    const s = await setup();
    expect((await deleteRunRoute(bearer(), s.env, "nope", s.deps)).status).toBe(404);
    expect((await deleteRunRoute(bearer(), s.env, "run-1", s.deps)).status).toBe(200);
    const again = await deleteRunRoute(bearer(), s.env, "run-1", s.deps);
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: "run not found" });
  });
});

describe("deleteRunRoute: running work", () => {
  const placed = (minutesAgo: number): string => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();

  it.each<InstanceStatus["status"]>(["running", "paused", "queued", "waiting"])("terminates a %s research Workflow before deleting", async (status) => {
    const s = await setup({ instances: { "run-1": status } });
    expect((await deleteRunRoute(bearer(), s.env, "run-1", s.deps)).status).toBe(200);
    expect(s.terminated).toEqual(["run-1"]);
    expect(s.deleted).toEqual(["run-1"]);
  });

  it("deletes a finished run whose Workflow instance is complete or no longer exists", async () => {
    const done = await setup({ instances: { "run-1": "complete" } });
    expect((await deleteRunRoute(bearer(), done.env, "run-1", done.deps)).status).toBe(200);
    expect(done.terminated).toEqual([]);
    const gone = await setup();
    expect((await deleteRunRoute(bearer(), gone.env, "run-1", gone.deps)).status).toBe(200);
    expect(gone.deleted).toEqual(["run-1"]);
  });

  it("terminates the call Workflows of approved calls, never of drafted or skipped ones", async () => {
    const s = await setup({
      calls: [
        { id: "call-done", status: "done", provider: "elevenlabs", approved_at: placed(60) },
        { id: "call-mock", status: "done", provider: "mock", approved_at: placed(1) },
        { id: "call-draft", status: "drafted", provider: "elevenlabs", approved_at: null },
        { id: "call-skip", status: "skipped", provider: "elevenlabs", approved_at: null },
      ],
      instances: { "call-done": "waiting", "call-mock": "running", "call-draft": "running", "call-skip": "running" },
    });
    expect((await deleteRunRoute(bearer(), s.env, "run-1", s.deps)).status).toBe(200);
    expect(s.terminated.sort()).toEqual(["call-done", "call-mock"]);
  });

  it("answers 409 while a live call is dialing and stops or deletes nothing", async () => {
    const s = await setup({
      calls: [{ id: "call-1", status: "dialing", provider: "elevenlabs", approved_at: placed(3) }],
      instances: { "run-1": "complete", "call-1": "waiting" },
    });
    const res = await deleteRunRoute(bearer(), s.env, "run-1", s.deps);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "a phone call is in progress, try again when it ends" });
    expect(s.terminated).toEqual([]);
    expect(s.deleted).toEqual([]);
  });

  it("does not let a stale dialing call (no result for over 40 minutes) block the delete", async () => {
    const s = await setup({
      calls: [{ id: "call-1", status: "dialing", provider: "elevenlabs", approved_at: placed(41) }],
      instances: { "call-1": "running" },
    });
    expect((await deleteRunRoute(bearer(), s.env, "run-1", s.deps)).status).toBe(200);
    expect(s.terminated).toEqual(["call-1"]);
  });

  it("answers 502 and deletes nothing when a Workflow cannot be reached", async () => {
    const s = await setup({ getError: new Error("internal error") });
    const res = await deleteRunRoute(bearer(), s.env, "run-1", s.deps);
    expect(res.status).toBe(502);
    expect(s.deleted).toEqual([]);
  });
});
