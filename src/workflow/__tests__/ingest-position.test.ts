/**
 * ingestPosition tests with a fake D1 (positions table in a Map), a fake R2 and an injected fetch.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/__tests__/ingest-position.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Cover I1-I14 of specs/positions-ingest.md: paste, LLM down, Greenhouse fetch, dedupe, 422, fallback, timeout, cap, R2 failure, race, title override, manual entry, Jobs.cz career-site widget chain, company and location overrides
 *
 * Design constraints:
 * - No module mocks; the fake D1 matches SQL prefixes and throws on anything unexpected
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { Ports } from "@/domain/ports";
import type { CreatePositionBody } from "@/app/api/_lib/position-body";
import { ingestPosition, type IngestDeps, ingestCapUsd, estimatePositionUsd } from "@/workflow/ingest-position";
import { fakeLlm } from "@/recipe/__tests__/fakes";
import { WIDGET_API } from "@/recipe/seams/posting-jobscz-widget";

const fixture = (name: string): string => readFileSync(new URL(`../../recipe/__tests__/fixtures/postings/${name}`, import.meta.url), "utf8");

type Row = Record<string, unknown>;
const NOW = new Date("2026-10-09T10:00:00.000Z");
const GH_URL = "https://boards.greenhouse.io/acme/jobs/12345";
const GH_API = "https://boards-api.greenhouse.io/v1/boards/acme/jobs/12345";
const LONG = "Requirements:\n" + "Five years of Python and data pipelines. ".repeat(10);

const goodLlm = fakeLlm(() => ({
  title: "Data Engineer",
  company: "Acme",
  location: "Praha",
  family: "data",
  must_haves: [1, 2, 3, 4].map((n) => ({ id: `mh-skill-${String(n)}`, text: `Skill ${String(n)}`, accepted_evidence: ["repo"] })),
}));

function makeEnv(opts: { putError?: Error; insertError?: Error } = {}) {
  const rows = new Map<string, Row>();
  const puts = new Map<string, string>();
  const sql: string[] = [];
  const byPair = (board: unknown, ext: unknown) => [...rows.values()].find((r) => r.board === board && r.external_id === ext);
  const exec = (q: string, a: unknown[]): Row[] => {
    sql.push(q);
    if (q.startsWith("SELECT id FROM positions WHERE board")) {
      const hit = byPair(a[0], a[1]);
      return hit ? [{ id: hit.id }] : [];
    }
    if (q.startsWith("INSERT INTO positions")) {
      if (opts.insertError) {
        // simulate the race: the other writer's row exists by now
        rows.set("race", { id: "race", board: "greenhouse:acme", external_id: "12345" });
        throw opts.insertError;
      }
      const cols = /\(([^)]*)\)\s*VALUES/.exec(q)?.[1]?.split(",").map((c) => c.trim()) ?? [];
      rows.set(a[0] as string, Object.fromEntries(cols.map((c, i) => [c, a[i]])));
      return [];
    }
    if (q.startsWith("UPDATE positions SET r2_key = NULL")) {
      const row = rows.get(a[0] as string);
      if (row) row.r2_key = null;
      return [];
    }
    throw new Error(`unexpected SQL: ${q}`);
  };
  const stmt = (q: string, a: unknown[] = []) => ({
    bind: (...b: unknown[]) => stmt(q, b),
    first: () => Promise.resolve(exec(q, a)[0] ?? null),
    run: () => {
      try {
        exec(q, a);
        return Promise.resolve({ meta: { changes: 1 } });
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
    },
  });
  const db = { prepare: (q: string) => stmt(q) } as unknown as D1Database;
  const bucket = {
    put: (key: string, value: string) => (opts.putError ? Promise.reject(opts.putError) : (puts.set(key, value), Promise.resolve({}))),
    delete: (key: string) => (puts.delete(key), Promise.resolve()),
  } as unknown as R2Bucket;
  return { db, bucket, rows, puts, sql };
}

function deps(env: ReturnType<typeof makeEnv>, over: Partial<IngestDeps> = {}): IngestDeps {
  let n = 0;
  return {
    db: env.db,
    bucket: env.bucket,
    ports: { llm: goodLlm },
    fetchFn: vi.fn(() => Promise.reject(new Error("no fetch expected"))),
    now: NOW,
    newId: () => `pos-${String(++n)}`,
    capUsd: 0.05,
    estimateUsd: () => 0.001,
    ...over,
  };
}

const ghPayload = JSON.stringify({ title: "Data Engineer", company_name: "Acme", location: { name: "Brno" }, content: `<p>${LONG}</p>` });
const okFetch = (payload = ghPayload) => vi.fn((_url: string) => Promise.resolve(new Response(payload, { status: 200 })));
const run = (d: IngestDeps, body: CreatePositionBody) => ingestPosition(d, body);

describe("ingestPosition", () => {
  it("I1: pasted text with a working LLM inserts a pasted row, stores the raw object and expires in 7 days", async () => {
    const env = makeEnv();
    const r = await run(deps(env), { postingText: LONG });
    expect(r).toMatchObject({ ok: true, id: "pos-1", reused: false });
    const row = env.rows.get("pos-1");
    expect(row).toMatchObject({ ingest_method: "pasted", ingest_cost_usd: 0.001, r2_key: "positions/pos-1.json", family: "data", board: null });
    const mustHaves = JSON.parse(row?.must_haves_json as string) as unknown[];
    expect(mustHaves.length).toBeGreaterThanOrEqual(3);
    expect(mustHaves.length).toBeLessThanOrEqual(5);
    expect(row?.expires_at).toBe("2026-10-16T10:00:00.000Z");
    expect(JSON.parse(env.puts.get("positions/pos-1.json") ?? "{}")).toMatchObject({ method: "pasted", raw: LONG.trim() });
  });

  it("I2: a throwing LLM still inserts a row with the 3 fallback must-haves and cost 0", async () => {
    const env = makeEnv();
    const llm = () => Promise.reject(new Error("credit exhausted"));
    const r = await run(deps(env, { ports: { llm } }), { postingText: LONG, title: "Data Engineer" });
    expect(r.ok && r.notes.join()).toContain("credit exhausted");
    const row = env.rows.get("pos-1");
    expect(row?.ingest_cost_usd).toBe(0);
    expect((JSON.parse(row?.must_haves_json as string) as unknown[]).length).toBe(3);
  });

  it("I3: a Greenhouse URL fetches the boards-api URL and stores board, external id and method", async () => {
    const env = makeEnv();
    const fetchFn = okFetch();
    const r = await run(deps(env, { fetchFn: fetchFn as unknown as typeof fetch }), { postingUrl: GH_URL });
    expect(r).toMatchObject({ ok: true, reused: false });
    expect(fetchFn.mock.calls[0]?.[0]).toBe(GH_API);
    expect(env.rows.get("pos-1")).toMatchObject({ ingest_method: "greenhouse", board: "greenhouse:acme", external_id: "12345", posting_url: GH_URL });
  });

  it("I4: the same Greenhouse URL twice returns the first id with no second fetch or LLM call", async () => {
    const env = makeEnv();
    const fetchFn = okFetch();
    let llmCalls = 0;
    const llm = ((input) => (llmCalls++, goodLlm(input))) as Ports["llm"];
    const d = deps(env, { fetchFn: fetchFn as unknown as typeof fetch, ports: { llm } });
    const first = await run(d, { postingUrl: GH_URL });
    const second = await run(d, { postingUrl: GH_URL });
    expect(first.ok && first.id).toBe("pos-1");
    expect(second).toMatchObject({ ok: true, id: "pos-1", reused: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(llmCalls).toBe(1);
  });

  it("I5: a 503 with no postingText gives 422 naming the host and inserts nothing", async () => {
    const env = makeEnv();
    const fetchFn = vi.fn(() => Promise.resolve(new Response("down", { status: 503 })));
    const r = await run(deps(env, { fetchFn: fetchFn as unknown as typeof fetch }), { postingUrl: GH_URL });
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(!r.ok && r.error).toMatch(/boards-api\.greenhouse\.io.*HTTP 503.*paste the posting text/);
    expect(env.rows.size).toBe(0);
  });

  it("I6: a failed fetch with postingText inserts a pasted row and a note names the failed method", async () => {
    const env = makeEnv();
    const fetchFn = vi.fn(() => Promise.resolve(new Response("down", { status: 503 })));
    const r = await run(deps(env, { fetchFn: fetchFn as unknown as typeof fetch }), { postingUrl: GH_URL, postingText: LONG });
    expect(r.ok && r.notes.join()).toContain("greenhouse");
    expect(env.rows.get("pos-1")).toMatchObject({ ingest_method: "pasted", posting_url: GH_URL, board: null, external_id: null });
  });

  it("I7: a fetch gets a 20 s abort signal and its timeout is treated as a failure", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError")));
    try {
      const env = makeEnv();
      const fetchFn = vi.fn((_url: string, init?: RequestInit) => Promise.reject(init?.signal?.reason as Error));
      const r = await run(deps(env, { fetchFn: fetchFn as unknown as typeof fetch }), { postingUrl: GH_URL });
      expect(timeout).toHaveBeenCalledWith(20_000);
      expect(r).toMatchObject({ ok: false, status: 422 });
      expect(!r.ok && r.error).toContain("timeout");
    } finally {
      timeout.mockRestore();
    }
  });

  it("I8: an estimate above the cap skips the LLM, uses the fallback and says so", async () => {
    const env = makeEnv();
    let llmCalls = 0;
    const llm = ((input) => (llmCalls++, goodLlm(input))) as Ports["llm"];
    const r = await run(deps(env, { ports: { llm }, estimateUsd: () => 1 }), { postingText: LONG });
    expect(llmCalls).toBe(0);
    expect(r.ok && r.notes.join()).toContain("POSITION_INGEST_USD");
    expect(env.rows.get("pos-1")?.ingest_cost_usd).toBe(0);
    expect((JSON.parse(env.rows.get("pos-1")?.must_haves_json as string) as unknown[]).length).toBe(3);
  });

  it("I9: an R2 put failure still returns ok with r2_key null and a note", async () => {
    const env = makeEnv({ putError: new Error("r2 down") });
    const r = await run(deps(env), { postingText: LONG });
    expect(r.ok && r.notes.join()).toContain("r2 down");
    expect(env.rows.get("pos-1")?.r2_key).toBeNull();
  });

  it("I10: a unique-index race on insert returns the existing id with reused true", async () => {
    const env = makeEnv({ insertError: new Error("D1_ERROR: UNIQUE constraint failed: positions.board, positions.external_id") });
    const r = await run(deps(env, { fetchFn: okFetch() as unknown as typeof fetch }), { postingUrl: GH_URL });
    expect(r).toMatchObject({ ok: true, id: "race", reused: true });
    expect(env.puts.size).toBe(0);
  });

  it("I11: the title in the body overrides the extracted title", async () => {
    const env = makeEnv();
    await run(deps(env), { postingText: LONG, title: "Lead Data Person" });
    expect(env.rows.get("pos-1")?.title).toBe("Lead Data Person");
  });
  it("I12: a title alone is a manual entry: method manual, generic must-haves, no fetch and no LLM call, company and location kept", async () => {
    const env = makeEnv();
    const llm = vi.fn(() => Promise.reject(new Error("must not be called")));
    const fetchFn = vi.fn(() => Promise.reject(new Error("must not fetch")));
    const r = await run(deps(env, { ports: { llm: llm as unknown as Ports["llm"] }, fetchFn: fetchFn as unknown as typeof fetch }), { title: "Obchodní zástupce", company: "Acme", location: "Brno" });
    expect(r).toMatchObject({ ok: true, reused: false, notes: [] });
    expect(llm).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
    const row = env.rows.get("pos-1");
    expect(row).toMatchObject({ ingest_method: "manual", extraction: "fallback", ingest_cost_usd: 0, title: "Obchodní zástupce", company: "Acme", location: "Brno", family: "sales", board: null, posting_url: null });
    const mustHaves = JSON.parse(row?.must_haves_json as string) as { id: string; text: string }[];
    expect(mustHaves.map((m) => m.id)).toEqual(["mh-title-experience", "mh-public-work", "mh-location-fit"]);
    expect(mustHaves[2]?.text).toContain("Brno");
    expect(JSON.parse(env.puts.get("positions/pos-1.json") ?? "{}")).toMatchObject({ method: "manual", raw: "" });
  });

  it("I13: a Jobs.cz career-site page without posting text goes through the widget chain and stores the GraphQL reply as raw", async () => {
    const env = makeEnv();
    const page = "https://jablotron.jobs.cz/detail-pozice?r=detail&id=2001283886&rps=0&impressionId=";
    const script = "https://jablotron.jobs.cz/assets/js/script.min.js?av=768f9ce6ef234ef2";
    const asset = "https://site-assets.jobs.cz/assets/jablotronalarms/768f9ce6ef234ef2/assets/js/script.min.js";
    const routes: Record<string, string> = {
      "https://www.jobs.cz/rpd/2001283886/": fixture("jobscz-widget-page.html"),
      [script]: fixture("jobscz-widget-redirect.html"),
      [asset]: fixture("jobscz-widget-script.js.txt"),
      [WIDGET_API]: fixture("jobscz-widget-reply.json"),
    };
    const fetchFn = vi.fn((url: string) => {
      const body = routes[url];
      if (body === undefined) return Promise.reject(new Error(`unexpected fetch ${url}`));
      // the rpd request redirects to the career site; Response.url is read-only, so mirror it through a property
      const res = new Response(body, { status: 200 });
      Object.defineProperty(res, "url", { value: url.startsWith("https://www.jobs.cz/rpd/") ? page : url });
      return Promise.resolve(res);
    });
    const r = await run(deps(env, { fetchFn: fetchFn as unknown as typeof fetch }), { postingUrl: "https://www.jobs.cz/rpd/2001283886/" });
    expect(r).toMatchObject({ ok: true, reused: false });
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual(["https://www.jobs.cz/rpd/2001283886/", script, asset, WIDGET_API]);
    const row = env.rows.get("pos-1");
    expect(row).toMatchObject({ ingest_method: "jobs-cz", board: "jobs.cz", external_id: "2001283886", title: "Delphi vývojář/ka - produktový vývoj - remote/onsite", company: "JABLOTRON CLOUD Services s.r.o.", location: "Jablonec nad Nisou" });
    expect(row?.excerpt as string).toContain("Delphi");
    expect(JSON.parse(env.puts.get("positions/pos-1.json") ?? "{}")).toMatchObject({ method: "jobs-cz", url: "https://www.jobs.cz/rpd/2001283886/" });
    expect((JSON.parse(env.puts.get("positions/pos-1.json") ?? "{}") as { raw: string }).raw).toContain("htmlContent");
  });

  it("I14: company and location in the body override the fetched ones; a widget failure without pasted text is a 422 naming the host", async () => {
    const env = makeEnv();
    const fetchFn = okFetch();
    await run(deps(env, { fetchFn: fetchFn as unknown as typeof fetch }), { postingUrl: GH_URL, company: "Acme Europe", location: "Praha" });
    expect(env.rows.get("pos-1")).toMatchObject({ company: "Acme Europe", location: "Praha" });

    const env2 = makeEnv();
    const bare = vi.fn(() => Promise.resolve(new Response("<html><body>Načítám...</body></html>", { status: 200 })));
    const r = await run(deps(env2, { fetchFn: bare as unknown as typeof fetch }), { postingUrl: "https://jablotron.jobs.cz/detail-pozice?r=detail&id=2001283886" });
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(!r.ok && r.error).toContain("jablotron.jobs.cz");
    expect(!r.ok && r.error).toContain("no career widget on the page");
    expect(env2.rows.size).toBe(0);
  });
});

describe("cost helpers", () => {
  it("ingestCapUsd defaults to 0.05 for unset or bad values and the default text stays under the cap", () => {
    expect(ingestCapUsd(undefined)).toBe(0.05);
    expect(ingestCapUsd("abc")).toBe(0.05);
    expect(ingestCapUsd("0")).toBe(0.05);
    expect(ingestCapUsd("0.2")).toBe(0.2);
    expect(estimatePositionUsd("x".repeat(20_000))).toBeLessThan(0.05);
  });
});
