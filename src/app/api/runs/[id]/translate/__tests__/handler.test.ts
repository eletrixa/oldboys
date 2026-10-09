/**
 * Tests for POST /api/runs/:id/translate (translateRoute) with a small D1 fake, an in-memory R2 fake and fake ports.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/translate/__tests__/handler.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Auth: session (same-origin required), bearer, none (401); another organization 403; unknown run 404; bad lang 400
 * - 409 without a finished brief; 503 without an AI key; 402 over the budget; 502 when every batch fails
 * - First call: verify-model calls, merged texts, the cache object and one llm ledger row without content
 * - A real-sized brief (18 claims, 5 sections, 4 interview questions, 3 to-verify items, gaps): several batches under
 *   the char budget, at most TRANSLATE_CONCURRENCY at a time, every text translated, one ledger row with the summed
 *   cost and the number of calls
 * - Some batches fail: the rest is answered with `partial: true`, not cached, the failed call's reported cost is in the
 *   ledger, and the failure is logged with name and message only (no texts)
 * - Cache hit: no model call; a changed brief is translated again
 *
 * Design constraints:
 * - No module mocks; the session lookup runs for real against the fake's session query
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Brief, Claim, LedgerEntry } from "@/domain/claim";
import type { LlmCall } from "@/domain/ports";
import { hashSessionToken, newSessionToken } from "@/domain/session";
import type { RunState } from "@/app/runs/[id]/state";
import { TRANSLATE_BATCH_CHARS, TRANSLATE_CONCURRENCY } from "@/domain/report-translation";
import { translateRoute, type TranslateDeps, type TranslateEnv } from "../handler";

const KEY = "translations/run-1/brief-cs.json";

const claim: Claim = {
  id: "c1", run_id: "run-1", question_id: "mh-ui", candidate_id: null, text: "Maintains the open-source library acme-ui.", kind: "FACT",
  confidence: 0.9, quote: "I maintain acme-ui", supports: ["s1"], contradicts: [], rank: 0,
};

const brief: Brief = {
  run_id: "run-1",
  profile: null,
  per_question: [{ question_id: "mh-ui", coverage: "evidenced", claim_ids: ["c1"], summary: "Builds UI libraries." }],
  interview_questions: ["How do you version acme-ui?"],
  to_verify: [],
  not_searched: [],
  searched_empty: [],
  removed_protected: 0,
  degraded: null,
  evidence: [],
  also_found: [],
  headline: null,
  location_note: null,
  sections: [{ id: "mh-ui", title: "UI libraries", confidence: 0.8, confidence_reason: "Two sources.", claim_ids: ["c1"], source_ids: ["s1"], summary: "" }],
};

const runState = (over: Partial<RunState> = {}): RunState => ({
  id: "run-1", subject: "Jan Novak", headline: null, role: null, position: null, organization_name: "Acme", created_at: "2026-10-09T00:00:00.000Z",
  status: "done", step: null, mentions: 1, candidates: [], claims: [claim], sources: [{ id: "s1", url: "https://github.com/jnovak/acme-ui" }],
  questions: [{ id: "mh-ui", text: "Builds UI component libraries" }], brief, failure: null, failed_step: null, step_index: 1, step_count: 1,
  cost: { usd: 0, source_calls: 0, llm_calls: 0, duration_ms: 0 }, intake: null, ...over,
});

type Run = { id: string; organization_id: string | null };
/** `failIds`: a batch whose prompt carries one of these ids throws (with `failCost` on the error, like the adapter). */
type Setup = { runs?: Run[]; state?: RunState | null; llm?: "ok" | "fail" | "none"; failIds?: string[]; failCost?: number };

async function setup(opts: Setup = {}) {
  const token = newSessionToken();
  const hash = await hashSessionToken(token);
  const sessionRow = { session_id: "s1", account_id: "a1", email: "hr@x.test", name: "HR", organization_id: "org-1", organization_name: "Acme" };
  const runs = opts.runs ?? [{ id: "run-1", organization_id: "org-1" }];
  const objects = new Map<string, string>();
  const ledgerRows: Omit<LedgerEntry, "seq" | "ts">[] = [];
  const prompts: { model: string; prompt: string }[] = [];
  const flight = { now: 0, max: 0 };

  const DB = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: () => {
          if (sql.startsWith("SELECT s.id AS session_id")) return Promise.resolve(args[0] === hash ? sessionRow : null);
          if (sql.startsWith("SELECT id, organization_id FROM investigations")) return Promise.resolve(runs.find((r) => r.id === args[0]) ?? null);
          throw new Error(`unexpected SQL: ${sql}`);
        },
      }),
    }),
  } as unknown as D1Database;

  const SOURCES = {
    get: (key: string) => {
      const body = objects.get(key);
      return Promise.resolve(body === undefined ? null : { text: () => Promise.resolve(body) });
    },
    put: (key: string, body: string) => {
      objects.set(key, body);
      return Promise.resolve(null);
    },
  } as unknown as R2Bucket;

  const llm = (async (input) => {
    prompts.push({ model: input.model, prompt: input.prompt });
    flight.now += 1;
    flight.max = Math.max(flight.max, flight.now);
    await new Promise((resolve) => setTimeout(resolve, 1));
    flight.now -= 1;
    const sent = JSON.parse(input.prompt.slice(input.prompt.indexOf("\n") + 1)) as { id: string; text: string }[];
    if (opts.llm === "fail" || sent.some((t) => opts.failIds?.includes(t.id) === true)) {
      throw Object.assign(new Error("No object generated: could not parse the response."), { name: "AI_NoObjectGeneratedError", finishReason: "length", cost_usd: opts.failCost ?? 0 });
    }
    const texts = sent.map((t) => ({ id: t.id, text: t.id === "c:c1" ? "Spravuje open-source knihovnu acme-ui." : `CS ${t.text}` }));
    return { value: input.schema.parse({ texts: [...texts, { id: "extra", text: "navíc" }] }), cost_usd: 0.012 };
  }) as LlmCall;

  let state = opts.state === undefined ? runState() : opts.state;
  const env: TranslateEnv = { DB, SOURCES, RUN_TOKEN: "secret" };
  const deps: TranslateDeps = {
    loadState: () => Promise.resolve(state),
    llm: opts.llm === "none" ? null : llm,
    ledger: (entry) => {
      ledgerRows.push(entry);
      return Promise.resolve({ ...entry, seq: ledgerRows.length, ts: "2026-10-09T02:00:00.000Z" });
    },
    now: () => 1000,
  };
  const setState = (next: RunState): void => {
    state = next;
  };
  return { env, deps, token, objects, ledgerRows, prompts, flight, setState };
}

/** The texts one fake call was given. */
const sentIds = (prompt: string): string[] => (JSON.parse(prompt.slice(prompt.indexOf("\n") + 1)) as { id: string }[]).map((t) => t.id);

const sentence = (n: number, words: string): string => `${words} ${"and kept the records of it in the public repository ".repeat(n)}`.trim();

/** About the size of the production brief that failed: 18 claims, 5 sections, 4 interview questions, 3 to-verify items, gaps. */
function realBrief(): RunState {
  const claims: Claim[] = Array.from({ length: 18 }, (_, i) => ({
    ...claim, id: `c${String(i + 1)}`, question_id: `mh-${String(i % 5)}`, text: sentence(3, `Claim ${String(i + 1)}: led the payments migration`),
    quote: `quote ${String(i + 1)}`,
  }));
  const sections = Array.from({ length: 5 }, (_, s) => ({
    id: `mh-${String(s)}`, title: `Section ${String(s)} about delivery`, confidence: 0.8 - s / 10, confidence_reason: sentence(1, "Two independent sources"),
    claim_ids: claims.filter((c) => c.question_id === `mh-${String(s)}`).map((c) => c.id), source_ids: ["s1"], summary: sentence(5, "The person shipped work"),
  }));
  return runState({
    claims,
    questions: sections.map((s) => ({ id: s.id, text: `Must-have ${s.id}` })),
    brief: {
      ...brief,
      per_question: sections.map((s) => ({ question_id: s.id, coverage: "evidenced", claim_ids: s.claim_ids, summary: s.summary })),
      sections,
      interview_questions: Array.from({ length: 4 }, (_, i) => sentence(2, `Question ${String(i)}: how did you plan the rollout`)),
      to_verify: Array.from({ length: 3 }, (_, i) => sentence(2, `Check ${String(i)}: the dates of the contract`)),
      not_searched: [{ source: "github", reason: "role is not technical" }],
      searched_empty: [{ source: "stackexchange", reason: "no results" }],
      location_note: "Lives in Prague according to the profile.",
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

const SAME_ORIGIN = { "Sec-Fetch-Site": "same-origin", Origin: "https://oldboys.test", Host: "oldboys.test" };

function req(headers: Record<string, string>, body: unknown = { lang: "cs" }): Request {
  return new Request("https://oldboys.test/api/runs/run-1/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const session = (token: string): Record<string, string> => ({ ...SAME_ORIGIN, Cookie: `oldboys_session=${token}` });

describe("POST /api/runs/:id/translate", () => {
  it("translates once, caches the result and writes one llm ledger row without content", async () => {
    const t = await setup();
    const res = await translateRoute(req(session(t.token)), t.env, "run-1", t.deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json<{ lang: string; texts: Record<string, string>; cached: boolean }>();
    expect(body.lang).toBe("cs");
    expect(body.cached).toBe(false);
    expect(body.texts["c:c1"]).toBe("Spravuje open-source knihovnu acme-ui.");
    expect(body.texts.extra).toBeUndefined();
    expect(t.prompts).toHaveLength(1);
    expect(t.prompts[0]?.model).toBe("verify");
    expect(t.prompts[0]?.prompt).not.toContain("I maintain acme-ui");
    expect(t.prompts[0]?.prompt).not.toContain("https://");
    expect(t.ledgerRows).toEqual([
      { run_id: "run-1", step: "translate", kind: "llm", cost_usd: 0.012, ms: 0, ref: expect.objectContaining({ translate: "cs", calls: 1 }) as unknown },
    ]);
    expect(JSON.stringify(t.ledgerRows)).not.toContain("acme-ui");
    expect(JSON.parse(t.objects.get(KEY) ?? "{}")).toMatchObject({ lang: "cs", texts: body.texts });
  });

  it("serves the cache for the same brief without a model call, and translates a changed brief again", async () => {
    const t = await setup();
    await translateRoute(req(session(t.token)), t.env, "run-1", t.deps);
    const again = await translateRoute(req(session(t.token)), t.env, "run-1", t.deps);
    expect((await again.json<{ cached: boolean }>()).cached).toBe(true);
    expect(t.prompts).toHaveLength(1);
    expect(t.ledgerRows).toHaveLength(1);

    t.setState(runState({ claims: [{ ...claim, text: "Maintains acme-ui and acme-icons." }] }));
    const changed = await translateRoute(req(session(t.token)), t.env, "run-1", t.deps);
    expect((await changed.json<{ cached: boolean }>()).cached).toBe(false);
    expect(t.prompts).toHaveLength(2);
  });

  it("accepts the bearer for machine clients", async () => {
    const t = await setup();
    expect((await translateRoute(req({ Authorization: "Bearer secret" }), t.env, "run-1", t.deps)).status).toBe(200);
  });

  it("asks for a login without a session or bearer, and refuses a cross-origin session", async () => {
    const t = await setup();
    expect((await translateRoute(req({}), t.env, "run-1", t.deps)).status).toBe(401);
    const cross = await translateRoute(req({ Cookie: `oldboys_session=${t.token}`, "Sec-Fetch-Site": "cross-site" }), t.env, "run-1", t.deps);
    expect(cross.status).toBe(403);
    expect(t.prompts).toHaveLength(0);
  });

  it("refuses a run of another organization, an unknown run and a wrong language", async () => {
    const other = await setup({ runs: [{ id: "run-1", organization_id: "org-2" }] });
    expect((await translateRoute(req(session(other.token)), other.env, "run-1", other.deps)).status).toBe(403);
    const t = await setup();
    expect((await translateRoute(req(session(t.token)), t.env, "run-x", t.deps)).status).toBe(404);
    expect((await translateRoute(req(session(t.token), { lang: "de" }), t.env, "run-1", t.deps)).status).toBe(400);
    expect(t.prompts).toHaveLength(0);
  });

  it("answers 409 while the brief is not finished", async () => {
    const t = await setup({ state: runState({ brief: null, status: "running" }) });
    expect((await translateRoute(req(session(t.token)), t.env, "run-1", t.deps)).status).toBe(409);
  });

  it("answers 503 without an AI key (no call, no row) and 502 when every batch fails, caching nothing but recording the calls", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const none = await setup({ llm: "none" });
    expect((await translateRoute(req(session(none.token)), none.env, "run-1", none.deps)).status).toBe(503);
    expect(none.ledgerRows).toHaveLength(0);
    const fail = await setup({ llm: "fail", failCost: 0.02 });
    expect((await translateRoute(req(session(fail.token)), fail.env, "run-1", fail.deps)).status).toBe(502);
    expect(fail.objects.size).toBe(0);
    expect(fail.ledgerRows).toEqual([
      expect.objectContaining({ step: "translate", kind: "llm", cost_usd: 0.02, ref: expect.objectContaining({ calls: 1, failed_calls: 1, translated: 0 }) as unknown }),
    ]);
  });

  it("translates a real-sized brief in parallel batches under the char budget and records one row with the summed cost", async () => {
    const t = await setup({ state: realBrief() });
    const res = await translateRoute(req(session(t.token)), t.env, "run-1", t.deps);
    expect(res.status).toBe(200);
    const body = await res.json<{ texts: Record<string, string>; cached: boolean; partial?: boolean }>();
    expect(body.partial).toBeUndefined();

    const calls = t.prompts.length;
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(t.flight.max).toBeLessThanOrEqual(TRANSLATE_CONCURRENCY);
    expect(t.flight.max).toBeGreaterThan(1);
    const ids = t.prompts.flatMap((p) => sentIds(p.prompt));
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of t.prompts) {
      const sent = JSON.parse(p.prompt.slice(p.prompt.indexOf("\n") + 1)) as { text: string }[];
      expect(sent.reduce((n, x) => n + x.text.length, 0)).toBeLessThanOrEqual(TRANSLATE_BATCH_CHARS);
      expect(p.model).toBe("verify");
    }
    expect(Object.keys(body.texts).sort()).toEqual([...ids].sort());
    expect(body.texts["c:c1"]).toBe("Spravuje open-source knihovnu acme-ui.");
    expect(body.texts["iq:3"]).toMatch(/^CS Question 3/);

    expect(t.ledgerRows).toHaveLength(1);
    expect(t.ledgerRows[0]?.cost_usd).toBeCloseTo(0.012 * calls, 10);
    expect(t.ledgerRows[0]?.ref).toEqual({ translate: "cs", texts: ids.length, translated: ids.length, calls, failed_calls: 0 });
    expect(JSON.parse(t.objects.get(KEY) ?? "{}")).toMatchObject({ texts: body.texts });
  });

  it("answers the translated part with partial: true when a batch fails, caches nothing, records its cost and logs no text", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const opts: Setup = { state: realBrief(), failIds: ["iq:0"], failCost: 0.03 };
    const t = await setup(opts);
    const res = await translateRoute(req(session(t.token)), t.env, "run-1", t.deps);
    expect(res.status).toBe(200);
    const body = await res.json<{ texts: Record<string, string>; cached: boolean; partial?: boolean }>();
    expect(body.partial).toBe(true);
    expect(body.cached).toBe(false);

    const failedBatch = t.prompts.findIndex((p) => sentIds(p.prompt).includes("iq:0"));
    const failedIds = sentIds(t.prompts[failedBatch]?.prompt ?? "");
    for (const id of failedIds) expect(body.texts[id]).toBeUndefined();
    expect(body.texts["c:c1"]).toBe("Spravuje open-source knihovnu acme-ui.");
    expect(t.objects.size).toBe(0);

    const calls = t.prompts.length;
    expect(t.ledgerRows).toHaveLength(1);
    expect(t.ledgerRows[0]?.cost_usd).toBeCloseTo(0.012 * (calls - 1) + 0.03, 10);
    expect(t.ledgerRows[0]?.ref).toMatchObject({ calls, failed_calls: 1 });

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith("translate failed", {
      runId: "run-1", batch: failedBatch, name: "AI_NoObjectGeneratedError", message: "No object generated: could not parse the response.", finishReason: "length",
    });
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain("Question 0");
    expect(logged).not.toContain("payments migration");

    // The retry translates again (nothing was cached) and, now that every batch answers, caches the full result.
    opts.failIds = [];
    const again = await translateRoute(req(session(t.token)), t.env, "run-1", t.deps);
    const full = await again.json<{ texts: Record<string, string>; cached: boolean; partial?: boolean }>();
    expect(full.cached).toBe(false);
    expect(full.partial).toBeUndefined();
    expect(t.prompts).toHaveLength(calls * 2);
    expect(Object.keys(full.texts)).toHaveLength((t.ledgerRows[0]?.ref as { texts: number }).texts);
    expect(t.objects.size).toBe(1);
  });

  it("refuses a brief whose translation could cost more than the budget, before any model call", async () => {
    const many = Array.from({ length: 200 }, (_, i) => `Question ${String(i)}: ${"x".repeat(300)}`);
    const t = await setup({ state: runState({ brief: { ...brief, interview_questions: many } }) });
    expect((await translateRoute(req(session(t.token)), t.env, "run-1", t.deps)).status).toBe(402);
    expect(t.prompts).toHaveLength(0);
  });
});
