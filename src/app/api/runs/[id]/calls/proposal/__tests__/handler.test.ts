/**
 * Tests for POST /api/runs/:id/calls/proposal (proposalRoute) and readCachedDraft with a small D1 fake, an in-memory R2 fake and fake ports.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/calls/proposal/__tests__/handler.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Auth: no session or bearer 401 (no model call); another organization 403; unknown run 404; queued run 409
 * - First call: one primary-model call, the AI proposal composed by call-brief (follow-up in the agent prompt), the
 *   cache object and one llm ledger row without content
 * - Cache hit: no model call; readCachedDraft (what the GET uses) returns the same proposal and never calls the model;
 *   changed research drafts again
 * - Fallbacks: model failure (ledger row with the reported cost, nothing cached), no AI key, budget used up,
 *   due-diligence run, no brief: rule-based proposal with a note
 *
 * Design constraints:
 * - No module mocks; the session lookup runs for real against the fake's session query
 */
import { describe, expect, it, vi } from "vitest";
import type { CallProposal } from "@/app/runs/[id]/call-panel";
import { buildCallBrief } from "@/domain/call-brief";
import { CALL_QUESTIONS_STEP } from "@/domain/call-questions-llm";
import type { Brief, LedgerEntry } from "@/domain/claim";
import type { LlmCall } from "@/domain/ports";
import { hashSessionToken, newSessionToken } from "@/domain/session";
import type { CallInputs } from "../../load";
import { proposalRoute, readCachedDraft, type ProposalDeps, type ProposalEnv } from "../handler";

const KEY = "call-questions/run-1.json";

const brief: Brief = {
  run_id: "run-1",
  per_question: [{ question_id: "mh-go", coverage: "partial", claim_ids: [], summary: "A Go CLI tool on GitHub from 2024." }],
  interview_questions: [],
  to_verify: [],
  not_searched: [],
  searched_empty: [],
  removed_protected: 0,
  degraded: null,
  evidence: [],
  also_found: [],
  headline: null,
  location_note: null,
  sections: [],
  profile: null,
};

const baseInputs: CallInputs = {
  subject: "Jan Novak",
  goal: "hiring",
  role: "Backend Engineer",
  status: "done",
  questions: [{ id: "mh-go", text: "Has the candidate built Go services?", title: "Go services" }],
  gaps: [],
  claims: [],
  brief,
};

const drafted = {
  questions: [
    {
      text: "Your GitHub has a Go CLI tool from 2024 - which part did you write yourself, and what was hardest?",
      why: "Partial evidence: Go services",
      listen_for: "Their own part, scale, libraries used.",
      follow_up: "Which libraries did you use, and how many users did it have?",
      closes: "mh-go",
    },
  ],
};

type Setup = { inputs?: CallInputs | null; llm?: "ok" | "fail" | "none"; runOrg?: string | null; spent?: number };

async function setup(opts: Setup = {}) {
  const token = newSessionToken();
  const hash = await hashSessionToken(token);
  const sessionRow = { session_id: "s1", account_id: "a1", email: "hr@x.test", name: "HR", organization_id: "org-1", organization_name: "Acme" };
  const objects = new Map<string, string>();
  const ledgerRows: Omit<LedgerEntry, "seq" | "ts">[] = [];
  const prompts: string[] = [];
  let inputs = opts.inputs === undefined ? baseInputs : opts.inputs;

  const DB = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: () => {
          if (sql.startsWith("SELECT s.id AS session_id")) return Promise.resolve(args[0] === hash ? sessionRow : null);
          if (sql.startsWith("SELECT id, organization_id FROM investigations")) {
            return Promise.resolve(args[0] === "run-1" ? { id: "run-1", organization_id: opts.runOrg === undefined ? "org-1" : opts.runOrg } : null);
          }
          if (sql.startsWith("SELECT COALESCE(SUM(cost_usd), 0) AS usd FROM ledger_entries")) {
            const usd = ledgerRows.filter((r) => r.step === args[1]).reduce((sum, r) => sum + r.cost_usd, opts.spent ?? 0);
            return Promise.resolve({ usd });
          }
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
    prompts.push(`${input.model}\n${input.prompt}`);
    await Promise.resolve();
    if (opts.llm === "fail") throw Object.assign(new Error("No object generated."), { name: "AI_NoObjectGeneratedError", cost_usd: 0.01 });
    return { value: input.schema.parse(drafted), cost_usd: 0.04 };
  }) as LlmCall;

  const env: ProposalEnv = { DB, SOURCES, RUN_TOKEN: "secret", CALL_BUDGET_USD: "0.50" };
  const deps: ProposalDeps = {
    loadInputs: (_db, runId) => Promise.resolve(runId === "run-1" ? inputs : null),
    llm: opts.llm === "none" ? null : llm,
    ledger: (entry) => {
      ledgerRows.push(entry);
      return Promise.resolve({ ...entry, seq: ledgerRows.length, ts: "2026-10-09T05:00:00.000Z" });
    },
    now: () => 1000,
  };
  const setInputs = (next: CallInputs): void => {
    inputs = next;
  };
  return { env, deps, token, objects, ledgerRows, prompts, setInputs, SOURCES };
}

const SAME_ORIGIN = { "Sec-Fetch-Site": "same-origin", Origin: "https://oldboys.test", Host: "oldboys.test" };
const session = (token: string): Record<string, string> => ({ ...SAME_ORIGIN, Cookie: `oldboys_session=${token}` });
const BEARER = { Authorization: "Bearer secret" };

function req(headers: Record<string, string>, runId = "run-1"): Request {
  return new Request(`https://oldboys.test/api/runs/${runId}/calls/proposal`, { method: "POST", headers });
}

describe("POST /api/runs/:id/calls/proposal", () => {
  it("drafts once with the primary model, caches the questions and writes one llm ledger row without content", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const t = await setup();
    const res = await proposalRoute(req(session(t.token)), t.env, "run-1", t.deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json<CallProposal>();
    expect(body).toMatchObject({ source: "ai", cached: false, note: null });
    expect(body.proposal.questions).toEqual([
      { question_id: "mh-go", text: drafted.questions[0]?.text, expected: "", why: "Partial evidence: Go services", listen_for: "Their own part, scale, libraries used.", follow_up: "Which libraries did you use, and how many users did it have?" },
    ]);
    expect(body.proposal.agent_prompt).toContain('If the answer is vague, ask: "Which libraries did you use, and how many users did it have?"');
    expect(body.proposal.first_message).not.toContain("libraries");
    expect(t.prompts).toHaveLength(1);
    expect(t.prompts[0]?.startsWith("primary\n")).toBe(true);
    expect(t.ledgerRows).toEqual([
      { run_id: "run-1", step: CALL_QUESTIONS_STEP, kind: "llm", cost_usd: 0.04, ms: 0, ref: { call_questions: "ai", questions: 1, calls: 1 } },
    ]);
    expect(JSON.parse(t.objects.get(KEY) ?? "{}")).toMatchObject({ questions: body.proposal.questions });
  });

  it("serves the cache without a model call (also to the GET), and drafts again when the research changed", async () => {
    const t = await setup();
    const first = await (await proposalRoute(req(BEARER), t.env, "run-1", t.deps)).json<CallProposal>();
    const second = await (await proposalRoute(req(BEARER), t.env, "run-1", t.deps)).json<CallProposal>();
    expect(second).toEqual({ ...first, cached: true });
    expect(t.prompts).toHaveLength(1);

    expect(await readCachedDraft(t.SOURCES, "run-1", baseInputs)).toEqual(first.proposal);
    expect(t.prompts).toHaveLength(1);

    const changed = { ...baseInputs, brief: { ...brief, to_verify: ["Worked at Acme from 2020."] } };
    expect(await readCachedDraft(t.SOURCES, "run-1", changed)).toBeNull();
    t.setInputs(changed);
    const third = await (await proposalRoute(req(BEARER), t.env, "run-1", t.deps)).json<CallProposal>();
    expect(third.cached).toBe(false);
    expect(t.prompts).toHaveLength(2);
  });

  it("falls back to the rule-based questions on a model failure, records its cost and caches nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const t = await setup({ llm: "fail" });
    const body = await (await proposalRoute(req(BEARER), t.env, "run-1", t.deps)).json<CallProposal>();
    expect(body.source).toBe("rules");
    expect(body.note).toContain("rule-based");
    expect(body.proposal).toEqual(buildCallBrief(baseInputs));
    expect(t.ledgerRows).toEqual([
      { run_id: "run-1", step: CALL_QUESTIONS_STEP, kind: "llm", cost_usd: 0.01, ms: 0, ref: { call_questions: "rules", questions: body.proposal.questions.length, calls: 1, reason: "the AI draft failed (AI_NoObjectGeneratedError)" } },
    ]);
    expect(t.objects.has(KEY)).toBe(false);
  });

  it("answers the rule-based questions without a model call: no AI key, budget used up, due-diligence, no brief", async () => {
    for (const [opts, note] of [
      [{ llm: "none" }, "no AI key"],
      [{ spent: 0.45 }, "budget"],
      [{ inputs: { ...baseInputs, goal: "due-diligence" } }, "hiring calls only"],
      [{ inputs: { ...baseInputs, brief: null } }, "not finished"],
    ] as const) {
      const t = await setup(opts);
      const res = await proposalRoute(req(BEARER), t.env, "run-1", t.deps);
      expect(res.status).toBe(200);
      const body = await res.json<CallProposal>();
      expect(body.source).toBe("rules");
      expect(body.note).toContain(note);
      expect(t.prompts).toHaveLength(0);
      expect(t.ledgerRows).toHaveLength(0);
    }
  });

  it("refuses without auth, for another organization, an unknown run and a queued run, never calling the model", async () => {
    const t = await setup();
    expect((await proposalRoute(req({}), t.env, "run-1", t.deps)).status).toBe(401);
    expect((await proposalRoute(req(BEARER, "run-x"), t.env, "run-x", t.deps)).status).toBe(404);
    const other = await setup({ runOrg: "org-2" });
    expect((await proposalRoute(req(session(other.token)), other.env, "run-1", other.deps)).status).toBe(403);
    const queued = await setup({ inputs: { ...baseInputs, status: "queued" } });
    expect((await proposalRoute(req(BEARER), queued.env, "run-1", queued.deps)).status).toBe(409);
    expect([...t.prompts, ...other.prompts, ...queued.prompts]).toHaveLength(0);
  });
});
