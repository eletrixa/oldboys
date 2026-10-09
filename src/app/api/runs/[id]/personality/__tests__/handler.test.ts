/**
 * Tests for POST /api/runs/:id/personality (personalityRoute) with a small D1 fake and fake ports.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/personality/__tests__/handler.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Auth: session, bearer, none (401); unknown run 404; another organization 403
 * - 409 without a brief or with a degraded profile; 503 without an AI key; 502 when the model throws (failed ledger row with the thrown cost)
 * - Happy path: brief_json updated with the new personality (big5 present), one llm ledger row (step profile_personality, cost),
 *   `{ personality }` answered, Cache-Control no-store
 *
 * Design constraints:
 * - No module mocks; the session lookup and the gate run for real against the fake rows
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Brief, LedgerEntry, Profile, Source } from "@/domain/claim";
import type { LlmCall } from "@/domain/ports";
import { hashSessionToken, newSessionToken } from "@/domain/session";
import { PERSONALITY_STEP, personalityRoute, type PersonalityDeps, type PersonalityEnv } from "../handler";

const QUOTE = "I plan every release in writing before I touch the code";
const source: Source = {
  id: "s1", run_id: "run-1", url: "https://example.test/cv.pdf", actor: "cv", fetched_at: "2026-10-09T00:00:00.000Z",
  excerpt: `About me. ${QUOTE} and I keep the team posted daily.`, r2_key: "oldboys-sources/run-1/s1.json", expires_at: "2026-11-09T00:00:00.000Z", identity: "merged",
};
const line = { quote: QUOTE, source_id: "s1", kind: "INFERENCE" as const, supports: true, direction: "supports" as const, note: "CV, self-reported" };

const profile: Profile = {
  achievements: [], risks: [], history: [], position_fit: [], questions: [], degraded: null,
  personality: { disc: null, mbti: null, big5: null, read: "old read", traits: [], evidence: [], evidence_dropped: 0 },
  achievements_dropped: 0, risks_dropped: 0, history_dropped: 0, fit_dropped: 0,
};
const brief: Brief = {
  run_id: "run-1", profile, per_question: [], interview_questions: [], to_verify: [], not_searched: [], searched_empty: [], removed_protected: 0,
  degraded: null, evidence: [], also_found: [], headline: null, location_note: null, sections: [],
};

type Run = { id: string; organization_id: string | null };
type Setup = { runs?: Run[]; brief?: Brief | null; llm?: "ok" | "fail" | "none"; failCost?: number };

async function setup(opts: Setup = {}) {
  const token = newSessionToken();
  const hash = await hashSessionToken(token);
  const sessionRow = { session_id: "s1", account_id: "a1", email: "hr@x.test", name: "HR", organization_id: "org-1", organization_name: "Acme" };
  const runs = opts.runs ?? [{ id: "run-1", organization_id: "org-1" }];
  const briefs = new Map<string, string>();
  if (opts.brief !== null) briefs.set("run-1", JSON.stringify(opts.brief ?? brief));
  const ledgerRows: Omit<LedgerEntry, "seq" | "ts">[] = [];
  const prompts: { model: string; prompt: string }[] = [];

  const DB = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: () => {
          if (sql.startsWith("SELECT s.id AS session_id")) return Promise.resolve(args[0] === hash ? sessionRow : null);
          if (sql.startsWith("SELECT id, organization_id FROM investigations")) return Promise.resolve(runs.find((r) => r.id === args[0]) ?? null);
          if (sql.startsWith("SELECT id, subject, anchor, role FROM investigations")) {
            return Promise.resolve(runs.some((r) => r.id === args[0]) ? { id: args[0], subject: "Jan Novak", anchor: "Acme", role: "CTO" } : null);
          }
          if (sql.startsWith("SELECT brief_json FROM briefs")) {
            const brief_json = briefs.get(args[0] as string);
            return Promise.resolve(brief_json === undefined ? null : { brief_json });
          }
          throw new Error(`unexpected SQL: ${sql}`);
        },
        all: () => {
          if (sql.startsWith("SELECT * FROM sources")) return Promise.resolve({ results: [source] });
          if (sql.startsWith("SELECT * FROM candidates")) return Promise.resolve({ results: [] });
          throw new Error(`unexpected SQL: ${sql}`);
        },
        run: () => {
          if (sql.startsWith("UPDATE briefs SET brief_json")) {
            briefs.set(args[1] as string, args[0] as string);
            return Promise.resolve({ success: true });
          }
          throw new Error(`unexpected SQL: ${sql}`);
        },
      }),
    }),
  } as unknown as D1Database;

  const llm = ((input) => {
    prompts.push({ model: input.model, prompt: input.prompt });
    if (opts.llm === "fail") {
      return Promise.reject(Object.assign(new Error("No object generated: could not parse the response."), { name: "AI_NoObjectGeneratedError", cost_usd: opts.failCost ?? 0 }));
    }
    const reading = {
      disc: { type: "C", confidence: "medium" },
      mbti: { type: "INTJ", confidence: "low" },
      big5: {
        traits: [{ dimension: "conscientiousness", lean: "high", position: 80, confidence: "medium", summary: "Plans in writing first.", evidence: [line] }],
        recommendations: [{ text: "Send the agenda ahead of the interview.", dimension: "conscientiousness" }],
      },
      read: "Plans ahead and communicates in writing.",
      traits: [{ text: "Planner", detail: "", evidence: [line] }],
      evidence: [line],
    };
    return Promise.resolve({ value: input.schema.parse({ personality: reading }), cost_usd: 0.04 });
  }) as LlmCall;

  const env: PersonalityEnv = { DB, RUN_TOKEN: "secret" };
  let tick = 1000;
  const deps: PersonalityDeps = {
    llm: opts.llm === "none" ? null : llm,
    ledger: (entry) => {
      ledgerRows.push(entry);
      return Promise.resolve({ ...entry, seq: ledgerRows.length, ts: "2026-10-09T02:00:00.000Z" });
    },
    now: () => (tick += 5),
  };
  return { env, deps, token, briefs, ledgerRows, prompts };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const SAME_ORIGIN = { "Sec-Fetch-Site": "same-origin", Origin: "https://oldboys.test", Host: "oldboys.test" };
const session = (token: string): Record<string, string> => ({ ...SAME_ORIGIN, Cookie: `oldboys_session=${token}` });
const req = (headers: Record<string, string>): Request => new Request("https://oldboys.test/api/runs/run-1/personality", { method: "POST", headers });

describe("POST /api/runs/:id/personality", () => {
  it("rebuilds the personality, stores it in the brief and writes one llm ledger row", async () => {
    const t = await setup();
    const res = await personalityRoute(req(session(t.token)), t.env, "run-1", t.deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json<{ personality: Profile["personality"] }>();
    expect(body.personality.big5?.traits).toHaveLength(1);
    expect(body.personality.big5?.traits[0]?.dimension).toBe("conscientiousness");
    expect(body.personality.big5?.recommendations).toHaveLength(1);
    expect(body.personality.disc).toEqual({ type: "C", confidence: "medium" });
    expect(body.personality.evidence_dropped).toBe(0);
    expect(t.prompts).toEqual([expect.objectContaining({ model: "primary" }) as unknown]);
    expect(t.prompts[0]?.prompt).toContain("Subject: Jan Novak");

    const stored = JSON.parse(t.briefs.get("run-1") ?? "{}") as Brief;
    expect(stored.profile?.personality).toEqual(body.personality);
    expect(stored.profile?.personality.big5).not.toBeNull();
    expect(t.ledgerRows).toEqual([
      { run_id: "run-1", step: PERSONALITY_STEP, kind: "llm", cost_usd: 0.04, ms: 5, ref: { big5: 1, lines: 1, dropped: 0 } },
    ]);
    expect(PERSONALITY_STEP).toBe("profile_personality");
  });

  it("accepts the bearer for machine clients", async () => {
    const t = await setup();
    expect((await personalityRoute(req({ Authorization: "Bearer secret" }), t.env, "run-1", t.deps)).status).toBe(200);
  });

  it("answers 401 without a session or bearer", async () => {
    const t = await setup();
    expect((await personalityRoute(req({}), t.env, "run-1", t.deps)).status).toBe(401);
    expect(t.prompts).toHaveLength(0);
  });

  it("answers 404 for an unknown run and 403 for another organization's run", async () => {
    const t = await setup();
    expect((await personalityRoute(req(session(t.token)), t.env, "run-x", t.deps)).status).toBe(404);
    const other = await setup({ runs: [{ id: "run-1", organization_id: "org-2" }] });
    expect((await personalityRoute(req(session(other.token)), other.env, "run-1", other.deps)).status).toBe(403);
    expect(other.prompts).toHaveLength(0);
  });

  it("answers 409 without a brief and when the profile is degraded", async () => {
    const none = await setup({ brief: null });
    expect((await personalityRoute(req(session(none.token)), none.env, "run-1", none.deps)).status).toBe(409);
    const degraded = await setup({ brief: { ...brief, profile: { ...profile, degraded: "model failed" } } });
    expect((await personalityRoute(req(session(degraded.token)), degraded.env, "run-1", degraded.deps)).status).toBe(409);
    expect(degraded.prompts).toHaveLength(0);
    expect(degraded.ledgerRows).toHaveLength(0);
  });

  it("answers 503 without an AI key, no call and no row", async () => {
    const t = await setup({ llm: "none" });
    expect((await personalityRoute(req(session(t.token)), t.env, "run-1", t.deps)).status).toBe(503);
    expect(t.ledgerRows).toHaveLength(0);
  });

  it("answers 502 when the model throws, keeps the brief and records the failed call with its cost", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const t = await setup({ llm: "fail", failCost: 0.02 });
    const before = t.briefs.get("run-1");
    expect((await personalityRoute(req(session(t.token)), t.env, "run-1", t.deps)).status).toBe(502);
    expect(t.briefs.get("run-1")).toBe(before);
    expect(t.ledgerRows).toEqual([expect.objectContaining({ step: PERSONALITY_STEP, kind: "llm", cost_usd: 0.02, ref: { failed: true } }) as unknown]);
    expect(error).toHaveBeenCalledWith("personality failed", { runId: "run-1", name: "AI_NoObjectGeneratedError", message: "No object generated: could not parse the response." });
  });
});
