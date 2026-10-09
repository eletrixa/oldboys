/**
 * Devil's advocate in verify (idea #8): one extra model call alongside the verify model, downgrade only.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/challenge.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - No call when nothing is eligible; a fork is challenged without the model
 * - Verdicts only downgrade; unknown ids and second answers are ignored; judging reasons are replaced
 * - A model failure keeps the claims; calls and cost are added to the outcome; the record lands in out.challenge
 *
 * Design constraints:
 * - Fake ports only; no network
 */
import { describe, expect, it } from "vitest";
import type { Claim, Source } from "@/domain/claim";
import { NEUTRAL_WHY } from "@/domain/challenge";
import type { Ports } from "@/domain/ports";
import { CHALLENGE_SYSTEM } from "@/recipe/seams/challenge";
import { verifyClaims } from "@/recipe/seams/verify";
import { baseContext, fakePorts } from "@/recipe/__tests__/fakes";

const repo: Source = { id: "repo", run_id: "run-1", url: "https://github.com/jd/etl", actor: "rest/github", fetched_at: "2026-10-08T00:00:00.000Z", excerpt: "etl · Airflow pipelines for Kiwi.com · Python · 5 stars · pushed 2026-09-01", r2_key: "k", expires_at: "e", identity: "merged" };
const fork: Source = { ...repo, id: "fork", url: "https://github.com/jd/react", excerpt: "react · forked repository · JavaScript · 0 stars · pushed 2019-01-01" };
const fact = (id: string, over: Partial<Claim> = {}): Claim => ({
  id, run_id: "run-1", question_id: "mh-python", candidate_id: null, text: `Writes Python (${id})`, kind: "FACT", confidence: 0.9, quote: "Airflow pipelines", supports: ["repo"], contradicts: [], rank: 1, ...over,
});

type Call = { model: string; system: string; prompt: string };

/** First call = the verify model (all supported), second = the devil's advocate answering `verdicts`. */
function twoModels(verdicts: unknown, calls: Call[] = []): Ports["llm"] {
  return ((input: Call) => {
    calls.push(input);
    if (input.system === CHALLENGE_SYSTEM) return Promise.resolve({ value: verdicts, cost_usd: 0.002 });
    return Promise.resolve({ value: [], cost_usd: 0.001 });
  }) as Ports["llm"];
}

const run = (claims: Claim[], llm: Ports["llm"], sources: Source[] = [repo, fork]) => verifyClaims(baseContext({ sources, claims }), fakePorts({ llm }));

describe("devil's advocate", () => {
  it("makes no extra call when no must-have FACT is left", async () => {
    const calls: Call[] = [];
    const out = await run([fact("base", { question_id: "current-role" }), fact("inf", { kind: "INFERENCE" })], twoModels([], calls));
    expect(calls.map((c) => c.system === CHALLENGE_SYSTEM)).toEqual([false]);
    expect(out.challenge).toEqual({ checked: 0, held: 0, challenges: [] });
    expect(out.calls).toBe(1);
  });

  it("challenges a fork without the model and sends the rest with quote window, URL and retrieved date", async () => {
    const calls: Call[] = [];
    const out = await run([fact("own"), fact("forked", { quote: "react", supports: ["fork"] })], twoModels([{ id: "own", holds: true, ground: null, why: "" }], calls));
    const prompt = calls.find((c) => c.system === CHALLENGE_SYSTEM)?.prompt ?? "";
    expect(prompt).toContain("id=own");
    expect(prompt).not.toContain("id=forked");
    expect(prompt).toContain("source: https://github.com/jd/etl");
    expect(prompt).toContain("retrieved: 2026-10-08T00:00:00.000Z");
    expect(prompt).toContain("around the quote: etl · Airflow pipelines for Kiwi.com");
    expect(Object.fromEntries(out.claims.map((c) => [c.id, c.kind]))).toEqual({ own: "FACT", forked: "INFERENCE" });
    expect(out.challenge).toEqual({ checked: 2, held: 1, challenges: [{ claim_id: "forked", ground: "fork-or-copy", why: NEUTRAL_WHY["fork-or-copy"] }] });
  });

  it("only downgrades: a failed claim becomes INFERENCE with confidence <= 0.5; unknown ids and second answers are ignored", async () => {
    const verdicts = [
      { id: "a", holds: false, ground: "tutorial-or-course", why: "README calls it a bootcamp week 3 exercise." },
      { id: "a", holds: true, ground: null, why: "" },
      { id: "b", holds: true, ground: null, why: "" },
      { id: "ghost", holds: false, ground: "outdated", why: "Old." },
      { id: "base", holds: false, ground: "someone-else", why: "Team page." },
    ];
    const out = await run([fact("a"), fact("b"), fact("base", { question_id: "current-role" }), fact("inf", { kind: "INFERENCE", confidence: 0.4 })], twoModels(verdicts));
    const byId = new Map(out.claims.map((c) => [c.id, c]));
    expect(byId.get("a")?.kind).toBe("INFERENCE");
    expect(byId.get("a")?.confidence).toBe(0.5);
    expect(byId.get("b")?.kind).toBe("FACT");
    expect(byId.get("base")?.kind).toBe("FACT");
    expect(byId.get("inf")).toMatchObject({ kind: "INFERENCE", confidence: 0.4 });
    expect(out.claims).toHaveLength(4);
    expect(out.challenge).toEqual({ checked: 2, held: 1, challenges: [{ claim_id: "a", ground: "tutorial-or-course", why: "README calls it a bootcamp week 3 exercise." }] });
    expect(out.notes).toContain("downgraded (devil's advocate, tutorial-or-course): a");
  });

  it("replaces a reason that judges the person and treats 'does not hold' without a ground as held", async () => {
    const out = await run([fact("a"), fact("b")], twoModels([{ id: "a", holds: false, ground: "outdated", why: "He inflated an old project." }, { id: "b", holds: false, ground: null, why: "?" }]));
    expect(out.challenge?.challenges).toEqual([{ claim_id: "a", ground: "outdated", why: NEUTRAL_WHY.outdated }]);
    expect(out.challenge?.held).toBe(1);
    expect(out.claims.find((c) => c.id === "b")?.kind).toBe("FACT");
  });

  it("keeps the claims when the challenger model fails, and counts only what was checked", async () => {
    const llm = ((input: Call) => (input.system === CHALLENGE_SYSTEM ? Promise.reject(new Error("overloaded")) : Promise.resolve({ value: [], cost_usd: 0.001 }))) as Ports["llm"];
    const out = await run([fact("a"), fact("forked", { quote: "react", supports: ["fork"] })], llm);
    expect(out.claims.find((c) => c.id === "a")?.kind).toBe("FACT");
    expect(out.claims.find((c) => c.id === "forked")?.kind).toBe("INFERENCE");
    expect(out.notes.join()).toContain("devil's advocate model failed, claims kept: overloaded");
    expect(out.challenge).toMatchObject({ checked: 1, held: 0 });
    expect(out.calls).toBe(1);
  });

  it("adds its call and cost to the outcome", async () => {
    const out = await run([fact("a")], twoModels([{ id: "a", holds: true, ground: null, why: "" }]));
    expect(out.calls).toBe(2);
    expect(out.cost_usd).toBeCloseTo(0.003);
  });

  it("issues both calls on the same deterministic result; a claim rejected by either path ends as INFERENCE", async () => {
    const calls: Call[] = [];
    const llm = ((input: Call) => {
      calls.push(input);
      if (input.system === CHALLENGE_SYSTEM) return Promise.resolve({ value: [{ id: "b", holds: false, ground: "outdated", why: "x" }, { id: "a", holds: true, ground: null, why: "" }], cost_usd: 0.002 });
      return Promise.resolve({ value: [{ id: "a", supported: false }, { id: "b", supported: true }, { id: "c", supported: true }], cost_usd: 0.001 });
    }) as Ports["llm"];
    const out = await run([fact("a"), fact("b"), fact("c")], llm);
    expect(calls.map((c) => c.system === CHALLENGE_SYSTEM).sort()).toEqual([false, true]);
    expect(Object.fromEntries(out.claims.map((c) => [c.id, c.kind]))).toEqual({ a: "INFERENCE", b: "INFERENCE", c: "FACT" });
    expect(out.calls).toBe(2);
  });
});
