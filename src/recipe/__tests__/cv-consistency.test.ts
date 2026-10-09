/**
 * CV consistency check (idea #14) through the seams: seed excerpt, extract prompt, verify screens, synthesize and sections.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/cv-consistency.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - The CV rule and the CV source label reach the extract prompt only on CV runs
 * - Verify: a CV check FACT quoted only from the CV is downgraded; judgemental CV check claims are dropped
 * - Synthesize: a difference becomes a templated interview question and the first to_verify item (also degraded);
 *   not-found items stay in the section; no model interview question for the CV check
 * - A run without a CV gets no cv-consistency entry anywhere in the brief
 * - The CV section's confidence is the same whether a statement matches or differs (never penalises the candidate)
 *
 * Design constraints:
 * - Fake ports only; no network
 */
import { describe, expect, it } from "vitest";
import type { Claim, Source } from "@/domain/claim";
import { CV_QUESTION, CV_QUESTION_ID } from "@/domain/cv-check";
import type { Ports } from "@/domain/ports";
import { CV_RULE, extractClaims } from "@/recipe/seams/extract";
import { sectionsOf } from "@/recipe/seams/sections";
import { CV_EXCERPT_MAX, seedProfile } from "@/recipe/seams/seed";
import { synthesizeBrief } from "@/recipe/seams/synthesize";
import { verifyClaims } from "@/recipe/seams/verify";
import { baseContext, fakeLlm, fakePorts } from "@/recipe/__tests__/fakes";

const src = (id: string, url: string, actor: string, excerpt: string): Source => ({
  id, run_id: "run-1", url, actor, fetched_at: "t", excerpt, r2_key: "k", expires_at: "e", identity: "merged",
});
const li = src("li", "https://www.linkedin.com/in/jana-dvorakova", "harvestapi/linkedin-profile-scraper", "Jana Dvořáková - Team Lead - Acme | LinkedIn\nTeam Lead at Acme since 2022. Data Engineer at Kiwi.com 2018-2022.");
const cv = src("cv", "cv:run-1", "cv", "Jana Dvořáková\nTeam Lead, Acme, 2020-now\nData Engineer, Kiwi.com, 2018-2020\nProject: Falcon ETL");

const claim = (id: string, question_id: string, kind: Claim["kind"], text: string, quote: string | null, supports: string[]): Claim => ({
  id, run_id: "run-1", question_id, candidate_id: null, text, kind, confidence: 0.8, quote, supports, contradicts: [], rank: 1,
});
const match = claim("m1", CV_QUESTION_ID, "FACT", "Data Engineer at Kiwi.com from 2018", "Data Engineer at Kiwi.com 2018-2022", ["li", "cv"]);
const DIFF = "CV: Team Lead at Acme from 2020. Public LinkedIn: Team Lead at Acme since 2022.";
const diff = claim("d1", CV_QUESTION_ID, "INFERENCE", DIFF, "Team Lead at Acme since 2022", ["li", "cv"]);
const notFound = claim("n1", CV_QUESTION_ID, "INFERENCE", "CV mentions the Falcon ETL project; no public source we checked mentions it", null, ["cv"]);
const role = claim("r1", "current-role", "FACT", "Team Lead at Acme", "Team Lead at Acme", ["li"]);
const ASK = "Your CV lists: Team Lead at Acme from 2020. The public LinkedIn shows: Team Lead at Acme since 2022. Could you walk us through it?";

const questions = [{ id: "current-role", text: "Current role and employer?" }, { id: "inference-only", text: "Anything inferred?" }];
const cvContext = (claims: Claim[]) => baseContext({ questions: [...questions, CV_QUESTION], sources: [li, cv], claims });
const plainContext = (claims: Claim[]) => baseContext({ questions, sources: [li], claims });

/** Summaries for every question, each with a model interview question; the protected-category check flags nothing. */
const summaryPorts = (onSystem: (s: string) => void = () => undefined): ReturnType<typeof fakePorts> =>
  fakePorts({
    llm: ((input: { system: string; prompt: string }) => {
      if (!input.prompt.startsWith("Role:")) return Promise.resolve({ value: [], cost_usd: 0 });
      onSystem(input.system);
      const ids = [...input.prompt.matchAll(/^## ([^:]+):/gm)].map((m) => m[1]);
      return Promise.resolve({ value: ids.map((id) => ({ question_id: id, summary: `summary ${String(id)}`, interview_question: `ask ${String(id)}` })), cost_usd: 0.001 });
    }) as Ports["llm"],
  });

describe("seed: the CV keeps its career history", () => {
  it("stores up to CV_EXCERPT_MAX characters of the CV as the excerpt, the full text in the raw payload", async () => {
    const long = `Jana Dvořáková\n${"Data Engineer at Kiwi.com 2018-2020. ".repeat(300)}`;
    const ports = fakePorts();
    const r = await seedProfile({ runId: "run-1", subject: "", anchor: "", profileUrl: null, cvText: long }, ports);
    const excerpt = r.out.sources[0]?.excerpt ?? "";
    expect(long.length).toBeGreaterThan(CV_EXCERPT_MAX);
    expect(excerpt).toHaveLength(CV_EXCERPT_MAX);
    expect(excerpt.length).toBeGreaterThan(2000);
    expect(ports.stored).toEqual([{ text: long }]);
  });
});

describe("extract: CV rule only on CV runs", () => {
  const capture = async (ctx: ReturnType<typeof baseContext>): Promise<{ system: string; prompt: string }> => {
    let seen = { system: "", prompt: "" };
    const llm = ((input: { system: string; prompt: string }) => {
      seen = { system: input.system, prompt: input.prompt };
      return Promise.resolve({ value: [], cost_usd: 0 });
    }) as Ports["llm"];
    await extractClaims(ctx, fakePorts({ llm }));
    return seen;
  };

  it("states the cv-consistency rule and labels the CV as candidate-supplied when the run has a CV", async () => {
    const { system, prompt } = await capture(cvContext([]));
    expect(system).toContain(CV_RULE);
    expect(system).toMatch(/FACT whose quote is verbatim from the PUBLIC source/);
    expect(system).toMatch(/'CV: <what the CV says>\. Public <platform>: <what the source says>\.'/);
    expect(system).toMatch(/at most 3 of these/);
    expect(system).toMatch(/never to `contradictions`/);
    expect(system).toMatch(/no words like fake, lie, inflated, dishonest or suspicious/);
    expect(prompt).toContain("[cv] cv:run-1 (candidate's CV, supplied by the candidate, not public)");
    expect(prompt).toContain(`- ${CV_QUESTION_ID}: ${CV_QUESTION.text}`);
  });

  it("leaves the prompt of a run without a CV untouched", async () => {
    const { system, prompt } = await capture(plainContext([]));
    expect(system).not.toContain(CV_QUESTION_ID);
    expect(prompt).not.toContain("candidate's CV");
    expect(prompt).not.toContain(CV_QUESTION_ID);
  });
});

describe("verify: CV check screens", () => {
  it("downgrades a CV check FACT whose quote is only in the CV, keeps one quoted from the public source", async () => {
    const selfQuoted = claim("s1", CV_QUESTION_ID, "FACT", "Worked on the Falcon ETL project", "Project: Falcon ETL", ["li", "cv"]);
    const out = await verifyClaims(cvContext([match, selfQuoted]), fakePorts({ llm: fakeLlm(() => []) }));
    expect(out.claims.find((c) => c.id === "m1")?.kind).toBe("FACT");
    expect(out.claims.find((c) => c.id === "s1")?.kind).toBe("INFERENCE");
    expect(out.notes).toContain("downgraded (quote only in the CV): s1");
  });

  it("keeps a CV-quoted FACT for other questions (the CV is a confirmed source there)", async () => {
    const cvFact = claim("c1", "current-role", "FACT", "Team Lead at Acme", "Team Lead, Acme", ["cv"]);
    const out = await verifyClaims(cvContext([cvFact]), fakePorts({ llm: fakeLlm(() => []) }));
    expect(out.claims[0]?.kind).toBe("FACT");
  });

  it("drops a CV check claim that judges the person", async () => {
    const verdict = claim("v1", CV_QUESTION_ID, "INFERENCE", "The CV looks inflated: Team Lead from 2020 vs 2022", null, ["li", "cv"]);
    const out = await verifyClaims(cvContext([verdict, diff]), fakePorts({ llm: fakeLlm(() => []) }));
    expect(out.claims.map((c) => c.id)).toEqual(["d1"]);
    expect(out.notes).toContain("dropped CV check claim (judges the person): v1");
  });
});

describe("synthesize: CV vs public record", () => {
  it("turns a difference into one neutral interview question and the first to_verify item; not-found stays in the section", async () => {
    let system = "";
    const out = await synthesizeBrief(cvContext([role, match, diff, notFound, claim("i1", "inference-only", "INFERENCE", "Leads a small team", null, ["li"])]), summaryPorts((s) => (system = s)));
    const brief = out.brief;
    expect(brief?.interview_questions).toEqual(["ask inference-only", ASK]);
    expect(brief?.interview_questions.join(" ")).not.toContain(`ask ${CV_QUESTION_ID}`);
    expect(brief?.to_verify).toEqual([DIFF, "Leads a small team"]);
    expect(brief?.per_question.find((q) => q.question_id === CV_QUESTION_ID)).toMatchObject({ coverage: "evidenced", claim_ids: ["m1", "d1", "n1"] });
    const section = brief?.sections.find((s) => s.id === CV_QUESTION_ID);
    expect(section).toMatchObject({ title: "CV vs public record", confidence_reason: "2 of 3 CV statements checked against public sources" });
    expect(system).toMatch(/A difference is a question for the interview, never a verdict/);
    // other claims citing the CV are never marked disputed by a CV difference
    expect(brief?.sections.find((s) => s.id === "current-role")?.confidence_reason).not.toMatch(/disagree/);
  });

  it("still asks about a difference when the summary model fails (degraded brief)", async () => {
    const out = await synthesizeBrief(cvContext([match, diff]), fakePorts());
    expect(out.brief?.degraded).toMatch(/summary model failed/);
    expect(out.brief?.interview_questions).toContain(ASK);
    expect(out.brief?.to_verify[0]).toBe(DIFF);
  });

  it("gives a run without a CV no cv-consistency entry anywhere", async () => {
    let system = "";
    const out = await synthesizeBrief(plainContext([role, claim("i1", "inference-only", "INFERENCE", "Leads a small team", null, ["li"])]), summaryPorts((s) => (system = s)));
    const brief = out.brief;
    expect(brief?.per_question.map((q) => q.question_id)).toEqual(["current-role", "inference-only"]);
    expect(brief?.sections.map((s) => s.id)).toEqual(["current-role", "inference-only"]);
    expect(brief?.interview_questions).toEqual(["ask inference-only"]);
    expect(brief?.to_verify).toEqual(["Leads a small team"]);
    expect(JSON.stringify(brief)).not.toMatch(/cv-consistency|CV vs public record|Your CV/);
    expect(system).not.toContain(CV_QUESTION_ID);
  });
});

describe("sections: the CV section rates how well the CV could be checked", () => {
  it("has the same confidence whether a statement matches or differs, and no 'sources disagree'", () => {
    const qs = [CV_QUESTION];
    const asMatch = claim("d1", CV_QUESTION_ID, "FACT", "Team Lead at Acme since 2022", "Team Lead at Acme since 2022", ["li", "cv"]);
    const a = sectionsOf(qs, [match, asMatch], [], [li, cv], [li, cv])[0];
    const b = sectionsOf(qs, [match, diff], [], [li, cv], [li, cv])[0];
    expect(a?.confidence).toBe(b?.confidence);
    expect(b?.confidence_reason).toBe("2 of 2 CV statements checked against public sources");
    expect(b?.confidence_reason).not.toMatch(/disagree/);
  });

  it("lower confidence only when fewer statements could be checked", () => {
    const qs = [CV_QUESTION];
    const checked = sectionsOf(qs, [match, diff], [], [li, cv], [li, cv])[0];
    const unchecked = sectionsOf(qs, [match, notFound], [], [li, cv], [li, cv])[0];
    expect(unchecked?.confidence).toBeLessThan(checked?.confidence ?? 0);
    expect(unchecked?.confidence_reason).toBe("1 of 2 CV statements checked against public sources");
  });
});
