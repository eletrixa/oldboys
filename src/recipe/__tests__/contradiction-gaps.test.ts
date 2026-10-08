/**
 * Compatible "contradictions" and stale unconfirmed gaps: both are dropped from the brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/contradiction-gaps.test.ts
 * Deps:    vitest, src/recipe/seams/{verify,synthesize,extract,resolve}
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - "over 13" vs "15 years" (claim text or model summary says compatible) leaves no contradictions section
 * - A gap recorded by a collector disappears once a merged source from the same step's actor exists
 *
 * Design constraints:
 * - Fake LLM only, no network
 */
import { describe, expect, it } from "vitest";
import type { Claim, Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { extractClaims } from "@/recipe/seams/extract";
import { UNCONFIRMED_GAP } from "@/recipe/seams/resolve";
import { synthesizeBrief } from "@/recipe/seams/synthesize";
import { screenClaims } from "@/recipe/seams/verify";
import { baseContext, fakePorts } from "@/recipe/__tests__/fakes";

const src = (id: string, actor: string, identity: Source["identity"]): Source => ({ id, run_id: "run-1", url: `https://example.com/${id}`, actor, fetched_at: "t", excerpt: "x", r2_key: "k", expires_at: "e", identity });
const claim = (id: string, q: string, text: string, supports = ["s1"]): Claim => ({ id, run_id: "run-1", question_id: q, candidate_id: null, text, kind: "INFERENCE", confidence: 0.5, quote: null, supports, contradicts: [], rank: 1 });
const questions = [{ id: "current-role", text: "Current role?" }, { id: "contradictions", text: "Which sources disagree?" }];
const llmWith = (contradictionsSummary: string): Ports["llm"] =>
  ((input: { prompt: string; model: string }) =>
    Promise.resolve({
      value: input.prompt.includes("coverage=")
        ? [{ question_id: "current-role", summary: "Role found.", interview_question: null }, { question_id: "contradictions", summary: contradictionsSummary, interview_question: "Which is right?" }]
        : [],
      cost_usd: 0.001,
    })) as Ports["llm"];

describe("compatible contradictions", () => {
  const text = "Groupon's team page states over 13 years of experience while Google's article states 15 years";

  it("screenClaims drops a contradictions claim that says compatible, keeps a real one", () => {
    const sources = [src("s1", "a", "merged")];
    const bad = claim("c1", "contradictions", `${text}; the figures are compatible`);
    const real = claim("c2", "contradictions", "Spend is $5M in one source and $9M in another");
    expect(screenClaims([bad, real], sources, "X").kept.map((c) => c.id)).toEqual(["c2"]);
  });

  it("no section, coverage none and a plain summary when the model summary calls the claim compatible", async () => {
    const ctx = baseContext({ questions, sources: [src("s1", "a", "merged")], claims: [claim("c1", "contradictions", text)] });
    const brief = (await synthesizeBrief(ctx, fakePorts({ llm: llmWith("'Over 13' is compatible with 15 ... no contradiction is established") }))).brief;
    const pq = brief?.per_question.find((p) => p.question_id === "contradictions");
    expect(pq).toMatchObject({ coverage: "none", claim_ids: [], summary: "No disagreement between sources was found." });
    expect(brief?.sections.some((s) => s.id === "contradictions")).toBe(false);
    expect(brief?.interview_questions).toEqual([]);
  });

  it("keeps the section for a real contradiction", async () => {
    const ctx = baseContext({ questions, sources: [src("s1", "a", "merged")], claims: [claim("c1", "contradictions", "Spend is $5M in one source and $9M in another")] });
    const brief = (await synthesizeBrief(ctx, fakePorts({ llm: llmWith("Two figures differ.") }))).brief;
    expect(brief?.sections.some((s) => s.id === "contradictions")).toBe(true);
  });

  it("extract prompt says rounded and 'over N' figures are not contradictions", async () => {
    let system = "";
    const llm = ((input: { system: string }) => {
      system = input.system;
      return Promise.resolve({ value: [], cost_usd: 0 });
    }) as Ports["llm"];
    await extractClaims(baseContext({ sources: [src("s1", "a", "merged")] }), fakePorts({ llm }));
    expect(system).toMatch(/'over N', 'N\+' and rounded/);
  });
});

describe("stale unconfirmed gaps", () => {
  const gap = (question_id: string, reason = UNCONFIRMED_GAP) => ({ run_id: "run-1", question_id, reason });

  it("drops the gap for a step whose source became merged; keeps one whose sources stayed unverified", async () => {
    const ctx = baseContext({
      sources: [src("y", "streamers/youtube-scraper", "merged"), src("w", "apify/website-content-crawler", "unverified")],
      gaps: [gap("youtube_channel"), gap("personal_site_crawl"), gap("orcid_search", "no ORCID record found")],
    });
    const brief = (await synthesizeBrief(ctx, fakePorts())).brief;
    expect(brief?.searched_empty.map((g) => g.source)).toEqual(["personal_site_crawl", "orcid_search"]);
  });

  it("leaves no 'none confirmed' gap once every such step is corroborated", async () => {
    const ctx = baseContext({ sources: [src("y", "streamers/youtube-scraper", "merged")], gaps: [gap("youtube_channel")] });
    expect((await synthesizeBrief(ctx, fakePorts())).brief?.searched_empty).toEqual([]);
  });
});
