/**
 * Tests for the LLM call-question drafter with a fake LlmCall.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/call-questions-llm.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Good output is mapped (ids to must-have / tv / gap ids, else ai-<n>), in model order, with why / listen_for / follow_up
 * - Safety: Art. 9 or off-limits text drops the question, an Art. 9 note drops the field; URLs dropped; dedupe; cap at 5
 * - Input: no personality, no also_found, no evidence quotes or URLs, no tool-failure gaps; primary model, small output cap
 * - Fallback to the rule-based questions on a throw (with its reported cost), timeout, invalid output, empty result,
 *   no brief, no LLM and a due-diligence goal
 * - The input hash changes with the research and is stable otherwise
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { MAX_CALL_QUESTIONS } from "@/domain/call-brief";
import {
  DRAFT_MAX_OUTPUT_TOKENS,
  type DraftInputs,
  type DraftOutput,
  draftCallQuestions,
  draftInputHash,
  drafterInput,
  ruleQuestions,
} from "@/domain/call-questions-llm";
import type { Brief, Claim } from "@/domain/claim";
import type { LlmCall } from "@/domain/ports";

const evidence = { quote: "I built the Airflow DAGs at https://github.com/jnovak/dags", source_id: "s1", kind: "FACT" as const, supports: true, note: "GitHub", strength: "weak" as const };

const brief: Brief = {
  run_id: "r1",
  per_question: [
    { question_id: "mh-airflow", coverage: "partial", claim_ids: ["c1"], summary: "A public repo with Airflow DAGs from 2023." },
    { question_id: "mh-spark", coverage: "none", claim_ids: [], summary: "" },
  ],
  interview_questions: [],
  to_verify: ["LinkedIn and the CV give different start dates at Acme (2019 vs 2020)."],
  not_searched: [],
  searched_empty: [],
  removed_protected: 0,
  degraded: null,
  evidence: [],
  also_found: [{ step: "serp", url: "https://example.org/namesake-jan-novak", excerpt: "Jan Novak, NAMESAKE plumber in Brno" }],
  headline: null,
  location_note: null,
  sections: [],
  profile: {
    achievements: [],
    risks: [{ text: "Short tenures", detail: "Three jobs in two years.", evidence: [evidence] }],
    history: [{ organization: "Acme", title: "Data Engineer", from: "2019", to: null, kind: "job", location: "", duration: "", summary: "Pipelines.", evidence: [evidence] }],
    personality: {
      disc: { type: "DISC-SECRET-D", confidence: "low" },
      mbti: { type: "MBTI-SECRET-INTJ", confidence: "low" },
      big5: null,
      read: "PERSONALITY-READ-SECRET",
      traits: [{ text: "TRAIT-SECRET", detail: "", evidence: [] }],
      evidence: [],
      evidence_dropped: 0,
    },
    position_fit: [{ role: "Data Engineer", fit_pct: 50, rationale: "", traits: [{ trait: "Spark at scale", status: "none", weight: 1, evidence: [] }, { trait: "SQL", status: "has", weight: 1, evidence: [] }] }],
    questions: [{ text: "How did you schedule the DAGs?", closes: "Airflow ownership" }],
    degraded: null,
    achievements_dropped: 0,
    risks_dropped: 0,
    history_dropped: 0,
    fit_dropped: 0,
  },
};

const weak: Claim = {
  id: "c2", run_id: "r1", question_id: "mh-airflow", candidate_id: null, text: "Led the data platform team.", kind: "INFERENCE",
  confidence: 0.4, quote: null, supports: [], contradicts: [], rank: 0,
};

const inputs: DraftInputs = {
  goal: "hiring",
  subject: "Jan Novak",
  role: "Senior Data Engineer",
  questions: [
    { id: "mh-airflow", text: "Has the candidate built Airflow pipelines?", title: "Airflow pipelines" },
    { id: "mh-spark", text: "Has the candidate used Spark at scale?", title: "Spark at scale" },
  ],
  gaps: [
    { run_id: "r1", question_id: "github_profile", reason: "no public talks found" },
    { run_id: "r1", question_id: "openalex_author", reason: "not searched: request failed: https://api.openalex.org/x?mailto=a@b.org HTTP 429" },
  ],
  claims: [weak],
  brief,
};

const q = (over: Partial<DraftOutput["questions"][number]> = {}): DraftOutput["questions"][number] => ({
  text: "Your public repo has Airflow DAGs from 2023 - which part did you build yourself, and what was the hardest problem?",
  why: "Closes the must-have Airflow pipelines (partial evidence).",
  listen_for: "A concrete DAG, their own part, scale and tools.",
  follow_up: "Which operators did you write, and how many DAGs ran daily?",
  closes: "mh-airflow",
  ...over,
});

type Seen = { model: string; system: string; prompt: string; maxOutputTokens?: number };

function fakeLlm(value: unknown, seen: Seen[] = [], cost = 0.03): LlmCall {
  return async (input) => {
    seen.push({ model: input.model, system: input.system, prompt: input.prompt, maxOutputTokens: input.maxOutputTokens });
    await Promise.resolve();
    return { value: input.schema.parse(value), cost_usd: cost };
  };
}

describe("drafterInput", () => {
  it("passes must-haves, to-verify, weak claims, risks, history, fit gaps, profile questions and plain gaps", () => {
    const input = drafterInput(inputs);
    expect(input.must_haves).toEqual([
      { id: "mh-airflow", must_have: "Airflow pipelines", coverage: "partial", found: "A public repo with Airflow DAGs from 2023." },
      { id: "mh-spark", must_have: "Spark at scale", coverage: "none", found: "" },
    ]);
    expect(input.to_verify).toEqual([{ id: "tv-1", text: "LinkedIn and the CV give different start dates at Acme (2019 vs 2020)." }]);
    expect(input.weak_claims).toEqual(["Led the data platform team."]);
    expect(input.risks).toEqual(["Short tenures: Three jobs in two years."]);
    expect(input.history).toEqual(["job: Data Engineer at Acme (2019 – present). Pipelines."]);
    expect(input.fit_gaps).toEqual(["Spark at scale (no evidence)"]);
    expect(input.profile_questions).toEqual([{ text: "How did you schedule the DAGs?", closes: "Airflow ownership" }]);
    expect(input.nothing_found).toEqual([{ id: "github_profile", text: "no public talks found" }]);
  });

  it("never sends personality, also_found, evidence quotes, URLs, e-mails or tool failures to the model", async () => {
    const seen: Seen[] = [];
    await draftCallQuestions(fakeLlm({ questions: [q()] }, seen), inputs);
    expect(seen).toHaveLength(1);
    const prompt = seen[0]?.prompt ?? "";
    for (const leak of ["SECRET", "NAMESAKE", "namesake", "example.org", "https://", "github.com/jnovak", "@b.org", "request failed", "HTTP 429", "I built the Airflow DAGs"]) {
      expect(prompt).not.toContain(leak);
    }
  });

  it("drops an Art. 9 or URL text from the input", () => {
    const input = drafterInput({ ...inputs, brief: { ...brief, to_verify: ["Took medical leave in 2021.", "Writes at https://blog.example.org", "Worked at Acme."] } });
    expect(input.to_verify).toEqual([{ id: "tv-3", text: "Worked at Acme." }]);
  });
});

describe("draftCallQuestions", () => {
  it("maps good output: ids, order, notes, primary model with a small output cap", async () => {
    const seen: Seen[] = [];
    const r = await draftCallQuestions(
      fakeLlm(
        {
          questions: [
            q(),
            q({ text: "Two of your public profiles give different start dates at Acme - which date is right?", closes: "tv-1", why: "To verify: start date" }),
            q({ text: "What is the largest Spark job you ran, and how much data did it process?", closes: "mh-unknown", why: "Spark at scale" }),
            q({ text: "Have you given any public talks on data engineering, and on what topic?", closes: "github_profile" }),
          ],
        },
        seen,
      ),
      inputs,
    );
    expect(r.source).toBe("ai");
    expect(r.reason).toBeNull();
    expect(r.cost_usd).toBe(0.03);
    expect(r.questions.map((x) => x.question_id)).toEqual(["mh-airflow", "tv-1", "ai-1", "github_profile"]);
    expect(r.questions[0]).toEqual({
      question_id: "mh-airflow",
      text: q().text,
      expected: "",
      why: q().why,
      listen_for: q().listen_for,
      follow_up: q().follow_up,
    });
    expect(seen[0]?.model).toBe("primary");
    expect(seen[0]?.maxOutputTokens).toBe(DRAFT_MAX_OUTPUT_TOKENS);
    expect(seen[0]?.system).toContain("never judges");
  });

  it("gives stable ids: the same output maps to the same ids, a reused closes id becomes ai-<n>", async () => {
    const out = { questions: [q(), q({ text: "Which Airflow version did you run in production, and why that one?" }), q({ text: "How did you test the DAGs before they ran?", closes: "" })] };
    const a = await draftCallQuestions(fakeLlm(out), inputs);
    const b = await draftCallQuestions(fakeLlm(out), inputs);
    expect(a.questions.map((x) => x.question_id)).toEqual(["mh-airflow", "ai-1", "ai-2"]);
    expect(b.questions).toEqual(a.questions);
  });

  it("drops a question whose text touches Art. 9 or an off-limits topic, and only the note when a note does", async () => {
    const r = await draftCallQuestions(
      fakeLlm({
        questions: [
          q({ text: "Did your health affect your time at Acme, and how?" }),
          q({ text: "What salary did you have at Acme, roughly?" }),
          q({ text: "See https://github.com/x - which part is yours?" }),
          q({ follow_up: "Was that during your religious holidays?", listen_for: "Mentions of their political views", why: "Health check" }),
        ],
      }),
      inputs,
    );
    expect(r.questions).toEqual([{ question_id: "mh-airflow", text: q().text, expected: "" }]);
  });

  it("dedupes repeated texts and caps at MAX_CALL_QUESTIONS", async () => {
    const many = Array.from({ length: 8 }, (_, i) => q({ text: `What did you build in project number ${String(i)}, and with which tools?`, closes: "" }));
    const r = await draftCallQuestions(fakeLlm({ questions: [q(), q({ text: `${q().text.toUpperCase()}  ` }), ...many] }), inputs);
    expect(r.questions).toHaveLength(MAX_CALL_QUESTIONS);
    expect(r.questions.filter((x) => x.text.toLowerCase() === q().text.toLowerCase())).toHaveLength(1);
  });

  it("drops a too-long question instead of cutting it", async () => {
    const r = await draftCallQuestions(fakeLlm({ questions: [q({ text: `${"Tell me about the pipeline ".repeat(12)}?` }), q()] }), inputs);
    expect(r.questions.map((x) => x.text)).toEqual([q().text]);
  });

  it("falls back to the rule-based questions on invalid output, a throw (with its cost), a timeout or nothing usable", async () => {
    const rules = ruleQuestions(inputs);
    expect(rules.length).toBeGreaterThan(0);

    const invalid = await draftCallQuestions(fakeLlm({ nope: true }), inputs);
    expect(invalid).toMatchObject({ source: "rules", questions: rules, calls: 1 });

    const throwing = (() => Promise.reject(Object.assign(new Error("cut"), { name: "AI_NoObjectGeneratedError", cost_usd: 0.02 }))) as LlmCall;
    expect(await draftCallQuestions(throwing, inputs)).toMatchObject({ source: "rules", questions: rules, cost_usd: 0.02, reason: "the AI draft failed (AI_NoObjectGeneratedError)" });

    const hanging = (() => new Promise(() => undefined)) as LlmCall;
    expect(await draftCallQuestions(hanging, inputs, 5)).toMatchObject({ source: "rules", questions: rules, calls: 1 });

    const empty = await draftCallQuestions(fakeLlm({ questions: [] }), inputs);
    expect(empty).toMatchObject({ source: "rules", questions: rules, cost_usd: 0.03, reason: "the AI draft had no usable question" });
  });

  it("does not ask the model without a brief, without an LLM or for a due-diligence call", async () => {
    const seen: Seen[] = [];
    const llm = fakeLlm({ questions: [q()] }, seen);
    expect(await draftCallQuestions(llm, { ...inputs, brief: null })).toMatchObject({ source: "rules", calls: 0 });
    expect(await draftCallQuestions(null, inputs)).toMatchObject({ source: "rules", calls: 0 });
    expect(await draftCallQuestions(llm, { ...inputs, goal: "due-diligence" })).toMatchObject({ source: "rules", calls: 0 });
    expect(seen).toHaveLength(0);
  });
});

describe("draftInputHash", () => {
  it("is stable for the same research and changes when it changes, but not with personality", async () => {
    const a = await draftInputHash(inputs);
    expect(await draftInputHash({ ...inputs })).toBe(a);
    expect(await draftInputHash({ ...inputs, brief: { ...brief, to_verify: ["Something new."] } })).not.toBe(a);
    const profile = brief.profile;
    if (profile === null) throw new Error("fixture");
    const otherPersonality = { ...brief, profile: { ...profile, personality: { ...profile.personality, read: "other" } } };
    expect(await draftInputHash({ ...inputs, brief: otherPersonality })).toBe(a);
  });
});
