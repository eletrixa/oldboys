/**
 * Resolve, extract and synthesize seam tests with a fake LLM.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/seams.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import type { Claim, Source } from "@/domain/claim";
import { extractClaims } from "@/recipe/seams/extract";
import { decisionFor, resolveCandidates } from "@/recipe/seams/resolve";
import { coverageOf, synthesizeBrief } from "@/recipe/seams/synthesize";
import { baseContext, fakeLlm, fakePorts } from "@/recipe/__tests__/fakes";

const s = (id: string, url: string, excerpt: string): Source => ({ id, run_id: "run-1", url, actor: "apify/google-search-scraper", fetched_at: "t", excerpt, r2_key: "k", expires_at: "e" });
const sources = [
  s("s1", "https://cz.linkedin.com/in/jana-dvorakova-data", "Jana Dvořáková - Data Engineer - Kiwi.com | LinkedIn\nData Engineer at Kiwi.com · Brno"),
  s("s2", "https://github.com/jdvorakova", "jdvorakova (Jana Dvořáková) · GitHub\nData pipelines, dbt, Airflow. Brno."),
  s("s3", "https://cz.linkedin.com/in/jana-dvorakova-nurse", "Jana Dvořáková - dětská sestra - FN Ostrava | LinkedIn\nPediatric nurse, Ostrava"),
];

describe("resolve", () => {
  it("thresholds map scores to merge / possibly-same-as / rejected", () => {
    expect(decisionFor(0.91)).toBe("merge");
    expect(decisionFor(0.55)).toBe("possibly-same-as");
    expect(decisionFor(0.2)).toBe("rejected");
  });

  it("never merges the Ostrava decoy and asks about the ambiguous one (LLM scores)", async () => {
    const ports = fakePorts({
      llm: fakeLlm((prompt) => {
        const ids = [...prompt.matchAll(/id=(id-\d+) platform=\w+ url=(\S+)/g)].map((m) => ({ id: m[1] ?? "", url: m[2] ?? "" }));
        return ids.map(({ id, url }) => ({ id, score: url.includes("nurse") ? 0.1 : url.includes("github") ? 0.55 : 0.92, reasons: ["test"] }));
      }),
    });
    const out = await resolveCandidates(baseContext({ sources }), ports);
    const byUrl = new Map(out.candidates.map((c) => [c.profile_urls[0], c.decision]));
    expect(byUrl.get("https://cz.linkedin.com/in/jana-dvorakova-nurse")).toBe("rejected");
    expect(byUrl.get("https://github.com/jdvorakova")).toBe("possibly-same-as");
    expect(byUrl.get("https://cz.linkedin.com/in/jana-dvorakova-data")).toBe("merge");
    expect(out.candidates[0]?.platform).toBe("linkedin");
  });

  it("falls back to anchor matching when the LLM fails", async () => {
    const out = await resolveCandidates(baseContext({ sources }), fakePorts());
    const byUrl = new Map(out.candidates.map((c) => [c.profile_urls[0], c.decision]));
    expect(byUrl.get("https://cz.linkedin.com/in/jana-dvorakova-data")).toBe("merge");
    expect(byUrl.get("https://cz.linkedin.com/in/jana-dvorakova-nurse")).toBe("possibly-same-as");
  });
});

describe("extract", () => {
  it("keeps valid claims, drops FACTs without quote and unknown questions, skips rejected profiles", async () => {
    const ports = fakePorts({
      llm: fakeLlm((prompt) => {
        expect(prompt).not.toContain("nurse");
        return [
          { question_id: "current-role", text: "Data Engineer at Kiwi.com", kind: "FACT", confidence: 0.9, quote: "Data Engineer at Kiwi.com", source_ids: ["s1"] },
          { question_id: "current-role", text: "no quote fact", kind: "FACT", confidence: 0.9, quote: null, source_ids: ["s1"] },
          { question_id: "unknown", text: "x", kind: "INFERENCE", confidence: 0.5, quote: null, source_ids: [] },
        ];
      }),
    });
    const ctx = baseContext({
      sources,
      candidates: [{ id: "c3", run_id: "run-1", name: "Jana", profile_urls: [sources[2]?.url ?? ""], anchor_match: null, score: 0.1, decision: "rejected", platform: "linkedin", handle: null, snippet: "", reasons: [] }],
    });
    const out = await extractClaims(ctx, ports);
    expect(out.claims).toHaveLength(1);
    expect(out.notes.join()).toContain("dropped invalid claim");
  });
});

describe("synthesize", () => {
  const claim = (id: string, q: string, kind: Claim["kind"], text: string): Claim => ({ id, run_id: "run-1", question_id: q, candidate_id: null, text, kind, confidence: 0.8, quote: kind === "INFERENCE" ? null : text, supports: kind === "INFERENCE" ? [] : ["s1"], contradicts: [], rank: 1 });

  it("computes coverage", () => {
    expect(coverageOf([claim("a", "q", "FACT", "x")])).toBe("evidenced");
    expect(coverageOf([claim("a", "q", "INFERENCE", "x")])).toBe("partial");
    expect(coverageOf([])).toBe("none");
  });

  it("drops protected-category claims by regex even when the model fails, and turns gaps into interview questions", async () => {
    const ctx = baseContext({
      sources,
      claims: [claim("ok", "current-role", "FACT", "Data Engineer at Kiwi.com"), claim("bad", "current-role", "INFERENCE", "Posts about her religious community")],
      gaps: [{ run_id: "run-1", question_id: "public-code", reason: "no public GitHub profile found" }],
    });
    const out = await synthesizeBrief(ctx, fakePorts());
    expect(out.brief?.removed_protected).toBe(1);
    expect(out.brief?.per_question.find((p) => p.question_id === "current-role")?.coverage).toBe("evidenced");
    expect(out.brief?.per_question.find((p) => p.question_id === "public-code")?.coverage).toBe("none");
    expect(out.brief?.interview_questions.join()).toContain("Public code");
    expect(out.brief?.not_searched[0]?.reason).toContain("GitHub");
  });
});
