/**
 * Tests for the /api/positions functions and route functions with a hand-written D1 fake.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/__tests__/handler.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Cover B3-B10, B13 and B14 of specs/positions-api.md (B1-B2 live in position-body.test.ts, B11-B12 are folded in here through getPosition)
 *
 * Design constraints:
 * - No module mocks; the fake matches SQL prefixes and throws on anything unexpected
 */
import { describe, expect, it } from "vitest";
import { fakeLlm } from "@/recipe/__tests__/fakes";
import { getPosition, listPositions, patchPosition } from "../handler";
import { createPositionRoute, getPositionRoute, listPositionsRoute, patchPositionRoute, type PositionsEnv } from "../routes";

type Row = Record<string, unknown>;
const mh = (id: string) => ({ id, text: "Has shipped X", accepted_evidence: ["repo"] });

function position(id: string, over: Row = {}): Row {
  return {
    id, title: `Title ${id}`, family: "data", company: "Acme", location: "Praha", board: null, posting_url: null, external_id: null,
    must_haves_json: JSON.stringify([mh("mh-a"), mh("mh-b")]), excerpt: "excerpt", r2_key: `positions/${id}.json`, ingest_method: "pasted",
    ingest_cost_usd: 0.01, created_at: "2026-10-08T10:00:00.000Z", expires_at: "2026-10-15T10:00:00.000Z", ...over,
  };
}

function makeDb(positions: Row[], runs: Row[] = [], applications: Row[] = [], tags: Row[] = []) {
  const exec = (q: string, a: unknown[]): { rows: Row[]; changes: number } => {
    if (q.startsWith("SELECT p.id")) {
      const keep = ["id", "title", "family", "company", "location", "posting_url", "ingest_method", "created_at", "expires_at"];
      const rows = [...positions]
        .sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))
        .map((p) => ({ ...Object.fromEntries(keep.map((k) => [k, p[k]])), runs: runs.filter((r) => r.position_id === p.id).length }));
      return { rows, changes: 0 };
    }
    if (q.startsWith("SELECT id, title, family")) {
      const hit = positions.find((p) => p.id === a[0]);
      return { rows: hit ? [Object.fromEntries(Object.entries(hit).filter(([k]) => k !== "r2_key"))] : [], changes: 0 };
    }
    const mine = () => runs.filter((r) => r.position_id === a[0]).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
    if (q.startsWith("SELECT i.id")) return { rows: mine().map((r) => ({ role: "x", questions_json: null, brief_json: null, sources_confirmed: 0, last_step: null, ...r })), changes: 0 };
    if (q.startsWith("SELECT id, source, name")) {
      const rows = applications
        .filter((r) => r.position_id === a[0])
        .sort((x, y) => String(y.received_at).localeCompare(String(x.received_at)) || String(y.id).localeCompare(String(x.id)))
        .map((r) => ({ has_profile: r.linkedin_url === undefined || r.linkedin_url === null ? 0 : 1, has_cv: r.cv_text === undefined || r.cv_text === null ? 0 : 1, ...Object.fromEntries(["id", "source", "name", "email", "status", "run_id", "note", "received_at", "linkedin_url"].map((k) => [k, r[k] ?? null])) }));
      return { rows, changes: 0 };
    }
    if (q.startsWith("SELECT tag, role")) return { rows: tags.filter((t) => t.position_id === a[0]), changes: 0 };
    if (q.startsWith("SELECT id FROM positions WHERE board")) {
      const hit = positions.find((p) => p.board === a[0] && p.external_id === a[1]);
      return { rows: hit ? [{ id: hit.id }] : [], changes: 0 };
    }
    if (q.startsWith("INSERT INTO positions")) {
      const cols = /\(([^)]*)\)\s*VALUES/.exec(q)?.[1]?.split(",").map((c) => c.trim()) ?? [];
      positions.push(Object.fromEntries(cols.map((c, i) => [c, a[i]])));
      return { rows: [], changes: 1 };
    }
    const upd = /^UPDATE positions SET (.*) WHERE id = \?$/.exec(q);
    if (upd) {
      const cols = (upd[1] ?? "").split(", ").map((c) => c.split(" = ")[0] ?? "");
      const hit = positions.find((p) => p.id === a[cols.length]);
      if (!hit) return { rows: [], changes: 0 };
      cols.forEach((c, i) => (hit[c] = a[i]));
      return { rows: [], changes: 1 };
    }
    throw new Error(`unexpected SQL: ${q}`);
  };
  const stmt = (q: string, a: unknown[] = []) => ({
    bind: (...b: unknown[]) => stmt(q, b),
    first: () => Promise.resolve(exec(q, a).rows[0] ?? null),
    all: () => Promise.resolve({ results: exec(q, a).rows }),
    run: () => Promise.resolve({ meta: { changes: exec(q, a).changes } }),
  });
  return { prepare: (q: string) => stmt(q) } as unknown as D1Database;
}

describe("positions functions", () => {
  it("B3: listPositions is newest first and counts runs (0 and 2)", async () => {
    const db = makeDb([position("old", { created_at: "2026-10-01T00:00:00.000Z" }), position("new")], [
      { id: "r1", position_id: "new" }, { id: "r2", position_id: "new" },
    ]);
    const list = await listPositions(db);
    expect(list.map((p) => [p.id, p.runs])).toEqual([["new", 2], ["old", 0]]);
  });

  it("B4: list items carry no must_haves, excerpt or r2_key", async () => {
    const [item] = await listPositions(makeDb([position("p1")]));
    expect(item).toBeDefined();
    for (const key of ["must_haves", "must_haves_json", "excerpt", "r2_key"]) expect(item).not.toHaveProperty(key);
  });

  it("B5: getPosition returns must_haves as an array, runs newest first and a group keyed by the position id", async () => {
    const db = makeDb([position("p1")], [
      { id: "r1", position_id: "p1", subject: "A", status: "done", created_at: "2026-10-08T10:00:00.000Z" },
      { id: "r2", position_id: "p1", subject: "B", status: "done", created_at: "2026-10-09T10:00:00.000Z" },
    ]);
    const detail = await getPosition(db, "p1");
    expect(Array.isArray(detail?.position.must_haves)).toBe(true);
    expect(detail?.position.must_haves).toHaveLength(2);
    expect(detail?.position).not.toHaveProperty("r2_key");
    expect(detail?.runs.map((r) => r.id)).toEqual(["r2", "r1"]);
    expect(detail?.group?.key).toBe("p1");
  });

  it("B11: a position with no runs has a null group and no runs; with runs the group is titled by the position, newest first, with brief labels", async () => {
    expect((await getPosition(makeDb([position("p1")]), "p1"))).toMatchObject({ runs: [], group: null });
    const questions_json = JSON.stringify([{ id: "mh-a", text: "Has shipped X" }]);
    const brief = (coverage: string) => JSON.stringify({ run_id: "x", per_question: [{ question_id: "mh-a", coverage, claim_ids: [], summary: "" }], degraded: null });
    const db = makeDb([position("p1", { title: "Staff Engineer" })], [
      { id: "old", position_id: "p1", subject: "A", status: "done", created_at: "2026-10-07T10:00:00.000Z", questions_json, brief_json: brief("none") },
      { id: "new", position_id: "p1", subject: "B", status: "done", created_at: "2026-10-08T10:00:00.000Z", questions_json, brief_json: brief("evidenced"), role: null },
    ]);
    const { group } = (await getPosition(db, "p1")) ?? {};
    expect(group).toMatchObject({ key: "p1", role: "Staff Engineer", run_count: 2, questions: ["Has shipped X"] });
    expect(group?.runs.map((r) => [r.id, r.cells])).toEqual([["new", ["documented"]], ["old", ["no evidence"]]]);
  });

  it("B12: a run without a brief is not checked in every cell", async () => {
    const questions_json = JSON.stringify([{ id: "mh-a", text: "Has shipped X" }]);
    const db = makeDb([position("p1")], [{ id: "r1", position_id: "p1", subject: "A", status: "done", created_at: "2026-10-07T10:00:00.000Z", questions_json }]);
    expect((await getPosition(db, "p1"))?.group?.runs[0]?.cells).toEqual(["not checked"]);
  });

  it("getPosition returns the pool newest first with presence flags only, and the bound tags", async () => {
    const apps = [
      { id: "a1", position_id: "p1", source: "manual", name: "Ada", status: "pooled", received_at: "2026-10-08T10:00:00.000Z", linkedin_url: "https://www.linkedin.com/in/ada", cv_text: null, cover_letter: "secret", external_id: "x" },
      { id: "a2", position_id: "p1", source: "email", name: null, status: "pooled", received_at: "2026-10-09T10:00:00.000Z", linkedin_url: null, cv_text: "my cv", cover_letter: null, external_id: "y" },
      { id: "a3", position_id: "other", source: "email", status: "pooled", received_at: "2026-10-09T11:00:00.000Z" },
    ];
    const tags = [{ tag: "staff-eng", role: "Staff", goal: "hiring", startupjobs_offer_id: null, position_id: "p1", created_at: "2026-10-08T10:00:00.000Z" }];
    const detail = await getPosition(makeDb([position("p1")], [], apps, tags), "p1");
    expect(detail?.candidates.map((c) => [c.id, c.has_profile, c.has_cv, c.handle, c.run])).toEqual([["a2", 0, 1, null, null], ["a1", 1, 0, "Ada", null]]);
    for (const c of detail?.candidates ?? []) for (const key of ["cv_text", "cover_letter", "external_id", "linkedin_url"]) expect(c).not.toHaveProperty(key);
    expect(detail?.tags.map((t) => t.tag)).toEqual(["staff-eng"]);
    expect((await getPosition(makeDb([position("p1")]), "p1"))).toMatchObject({ candidates: [], tags: [] });
  });

  it("getPosition attaches each pooled run's progress, fit % and independent-evidence count", async () => {
    const ev = { quote: "Led the launch", source_id: "s1", kind: "FACT", supports: true, strength: "strong" };
    const profile = {
      achievements: [{ text: "x", evidence: [ev] }], risks: [], history: [], questions: [], degraded: null,
      personality: { disc: null, mbti: null, read: "", evidence: [] },
      position_fit: [{ role: "Staff", fit_pct: 67, rationale: "", traits: [] }],
    };
    const runs = [
      { id: "r1", position_id: "p1", subject: "Ada King", status: "running", created_at: "2026-10-09T10:00:00.000Z", last_step: "seed_profile", last_at: "2020-01-01T00:00:00.000Z" },
      { id: "r2", position_id: "p1", subject: "Bo", status: "done", created_at: "2026-10-09T11:00:00.000Z", brief_json: JSON.stringify({ run_id: "r2", profile }) },
    ];
    const apps = [
      { id: "a1", position_id: "p1", source: "manual", status: "run-started", run_id: "r1", received_at: "2026-10-08T10:00:00.000Z", linkedin_url: "https://www.linkedin.com/in/ada" },
      { id: "a2", position_id: "p1", source: "manual", status: "run-started", run_id: "r2", received_at: "2026-10-09T10:00:00.000Z", cv_text: "cv" },
    ];
    const detail = await getPosition(makeDb([position("p1")], runs, apps), "p1");
    const [done, running] = detail?.candidates ?? [];
    expect(done?.run).toEqual({ status: "done", subject: "Bo", step: null, pct: 100, fit_pct: 67, independent: 1, stalled: false });
    expect(running?.run).toMatchObject({ status: "running", subject: "Ada King", step: "Web search", fit_pct: null, independent: 0, stalled: true });
    expect(running?.run?.pct).toBeGreaterThan(0);
    expect(running?.run?.pct).toBeLessThan(100);
  });

  it("getPosition names steps without an actor in plain words, never by their recipe id", async () => {
    const runs = [
      { id: "r1", position_id: "p1", subject: "", status: "running", created_at: "2026-10-09T10:00:00.000Z", last_step: null, last_at: "2099-01-01T00:00:00.000Z" },
      { id: "r2", position_id: "p1", subject: "Bo", status: "running", created_at: "2026-10-09T11:00:00.000Z", last_step: "press_serp", last_at: "2099-01-01T00:00:00.000Z" },
    ];
    const apps = [
      { id: "a1", position_id: "p1", source: "manual", status: "run-started", run_id: "r1", received_at: "2026-10-08T10:00:00.000Z", linkedin_url: "https://www.linkedin.com/in/ada" },
      { id: "a2", position_id: "p1", source: "manual", status: "run-started", run_id: "r2", received_at: "2026-10-09T10:00:00.000Z", cv_text: "cv" },
    ];
    const detail = await getPosition(makeDb([position("p1")], runs, apps), "p1");
    const steps = (detail?.candidates ?? []).map((c) => c.run?.step);
    expect(steps).toEqual(["Reading the sources", "Reading the profile"]);
  });

  it("B6: getPosition of an unknown or implausible id returns null", async () => {
    const db = makeDb([position("p1")]);
    expect(await getPosition(db, "nope")).toBeNull();
    expect(await getPosition(db, "x".repeat(65))).toBeNull();
  });

  it("B7: broken must_haves_json gives an empty array", async () => {
    const detail = await getPosition(makeDb([position("p1", { must_haves_json: "{broken" })]), "p1");
    expect(detail?.position.must_haves).toEqual([]);
    expect(detail?.group).toBeNull();
  });

  it("B8: patchPosition with a title leaves family and must-haves unchanged", async () => {
    const rows = [position("p1")];
    const updated = await patchPosition(makeDb(rows), "p1", { title: "Renamed" });
    expect(updated).toMatchObject({ title: "Renamed", family: "data" });
    expect(updated?.must_haves).toHaveLength(2);
    expect(updated?.extraction).not.toBe("edited");
  });

  it("B9: patchPosition with must_haves stores JSON that parses back and keeps expires_at", async () => {
    const rows = [position("p1")];
    const next = [mh("mh-new")];
    const updated = await patchPosition(makeDb(rows), "p1", { must_haves: next });
    expect(JSON.parse(rows[0]?.must_haves_json as string)).toEqual(next);
    expect(updated?.must_haves).toEqual(next);
    expect(updated?.expires_at).toBe("2026-10-15T10:00:00.000Z");
    expect(updated?.extraction).toBe("edited");
  });

  it("B10: patchPosition on an unknown id returns null", async () => {
    expect(await patchPosition(makeDb([]), "nope", { title: "x" })).toBeNull();
  });
});

describe("route functions", () => {
  const authed = (body?: unknown, method = "POST") =>
    new Request("http://x/api/positions", { method, headers: { Authorization: "Bearer secret" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const env = (rows: Row[] = [], token: string | undefined = "secret"): PositionsEnv => ({ DB: makeDb(rows), SOURCES: {} as R2Bucket, RESEARCH_RUN: {} as Workflow<{ runId: string }>, RUN_BUDGET_USD: "0.5", RUN_BUDGET_CALLS: "16", RUN_TOKEN: token });

  it("B13: every route is 401 without the bearer and 503 when RUN_TOKEN is unset; successes are no-store", async () => {
    const bare = () => new Request("http://x/api/positions", { method: "POST", body: "{}" });
    const calls: ((e: PositionsEnv, r: Request) => Promise<Response>)[] = [
      (e, r) => createPositionRoute(r, e),
      (e, r) => listPositionsRoute(r, e),
      (e, r) => getPositionRoute(r, e, "p1"),
      (e, r) => patchPositionRoute(r, e, "p1"),
    ];
    for (const call of calls) {
      const unauthorized = await call(env(), bare());
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.headers.get("Cache-Control")).toBe("no-store");
      expect((await call(env([], ""), authed({}))).status).toBe(503);
    }
    const listed = await listPositionsRoute(authed(undefined, "GET"), env([position("p1")]));
    expect(listed.status).toBe(200);
    expect(listed.headers.get("Cache-Control")).toBe("no-store");
    const missing = await getPositionRoute(authed(undefined, "GET"), env(), "nope");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Cache-Control")).toBe("no-store");
    const patched = await patchPositionRoute(authed({ title: "T" }, "PATCH"), env([position("p1")]), "p1");
    expect(patched.status).toBe(200);
    expect(await patched.json<{ position: { title: string } }>()).toMatchObject({ position: { title: "T" } });
    expect((await patchPositionRoute(authed({}, "PATCH"), env([position("p1")]), "p1")).status).toBe(400);
  });

  it("B14: create maps a new id to 201, reused to 200 and a failed ingest to 422 with the text", async () => {
    const GH = "https://boards.greenhouse.io/acme/jobs/12345";
    const rows = [position("existing", { board: "greenhouse:acme", external_id: "12345" })];
    const bucket = { put: () => Promise.resolve({}) } as unknown as R2Bucket;
    const e: PositionsEnv = { ...env(), DB: makeDb(rows), SOURCES: bucket };
    const llm = fakeLlm(() => ({ title: "Dev", family: "engineering", must_haves: [{ id: "mh-a", text: "A", accepted_evidence: [] }] }));
    const down = (() => Promise.resolve(new Response("down", { status: 503 }))) as unknown as typeof fetch;

    const created = await createPositionRoute(authed({ postingText: "A posting" }), e, { newId: () => "new-id", ports: { llm } });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ id: "new-id" });
    expect(rows.some((r) => r.id === "new-id")).toBe(true);

    const reused = await createPositionRoute(authed({ postingUrl: GH }), e, { fetchFn: down });
    expect(reused.status).toBe(200);
    expect(await reused.json()).toEqual({ id: "existing", reused: true });

    const failed = await createPositionRoute(authed({ postingUrl: "https://boards.greenhouse.io/acme/jobs/999" }), e, { fetchFn: down });
    expect(failed.status).toBe(422);
    expect((await failed.json<{ error: string }>()).error).toContain("paste the posting text");
    expect((await createPositionRoute(authed({ company: "no title" }), e)).status).toBe(400);
    const manual = await createPositionRoute(authed({ title: "Head of Sales", company: "Acme" }), e, { newId: () => "manual-id" });
    expect(manual.status).toBe(201);
    expect(rows.find((r) => r.id === "manual-id")).toMatchObject({ ingest_method: "manual", company: "Acme" });
  });
});
