/**
 * Resolve (incl. no-model fallback), extract and synthesize (incl. degraded brief) seam tests with a fake LLM.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/seams.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import type { Claim, Source } from "@/domain/claim";
import { extractClaims } from "@/recipe/seams/extract";
import { canonicalProfile, decisionFor, fallbackScores, resolveCandidates } from "@/recipe/seams/resolve";
import { coverageOf, synthesizeBrief } from "@/recipe/seams/synthesize";
import { baseContext, fakeLlm, fakePorts } from "@/recipe/__tests__/fakes";

const s = (id: string, url: string, excerpt: string): Source => ({ id, run_id: "run-1", url, actor: "apify/google-search-scraper", fetched_at: "t", excerpt, r2_key: "k", expires_at: "e", identity: "unverified" });
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

  it("falls back to anchor matching when the LLM fails and never merges on its own", async () => {
    const out = await resolveCandidates(baseContext({ sources }), fakePorts());
    const byUrl = new Map(out.candidates.map((c) => [c.profile_urls[0], c.decision]));
    expect(byUrl.get("https://cz.linkedin.com/in/jana-dvorakova-data")).toBe("possibly-same-as");
    expect(byUrl.get("https://cz.linkedin.com/in/jana-dvorakova-nurse")).toBe("possibly-same-as");
  });
});

describe("resolve fallback (no model)", () => {
  it("caps anchor substring at 0.6 and name only at 0.5, so a city never merges", () => {
    const scores = fallbackScores(
      [
        { id: "a", url: "https://elib.nlb.by/search?q=x", excerpt: "Josef Buryan Praha" },
        { id: "b", url: "https://chanceliga.cz/hrac/pokorny", excerpt: "Josef Buryan, footballer" },
      ],
      "Praha",
    );
    expect(scores.map((x) => x.score)).toEqual([0.6, 0.5]);
    expect(scores.map((x) => decisionFor(x.score))).toEqual(["possibly-same-as", "possibly-same-as"]);
  });

  it("merges only on hard links: anchor URL, or cross-linked drafts with the anchor in one", () => {
    const byAnchorUrl = fallbackScores([{ id: "a", url: "https://www.jana.dev/", excerpt: "Jana" }], "jana.dev");
    expect(decisionFor(byAnchorUrl[0]?.score ?? 0)).toBe("merge");
    const cross = fallbackScores(
      [
        { id: "a", url: "https://github.com/jdvorakova", excerpt: "Brno. https://cz.linkedin.com/in/jana-dvorakova-data" },
        { id: "b", url: "https://cz.linkedin.com/in/jana-dvorakova-data", excerpt: "Data Engineer" },
        { id: "c", url: "https://x.com/jana", excerpt: "Jana in Brno" },
      ],
      "Brno",
    );
    expect(cross.map((x) => decisionFor(x.score))).toEqual(["merge", "merge", "possibly-same-as"]);
  });

  it("dedupes by host + path keeping the best score and drops PDF and genealogy noise", async () => {
    const out = await resolveCandidates(
      baseContext({
        sources: [
          s("d1", "https://rejstrik.penize.cz/osoba/jana-dvorakova?x=1", "Jana Dvořáková"),
          s("d2", "https://www.rejstrik.penize.cz/osoba/jana-dvorakova/", "Jana Dvořáková, Brno"),
          s("n1", "https://www.myheritage.cz/names/jana_dvorakova", "Jana Dvořáková"),
          s("n2", "https://example.cz/cv/dvorakova.pdf", "Jana Dvořáková"),
        ],
      }),
      fakePorts(),
    );
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0]?.score).toBe(0.6);
  });
});

describe("extract", () => {
  it("returns an empty outcome with a note when the model fails, never throws", async () => {
    const out = await extractClaims(baseContext({ sources }), fakePorts());
    expect(out.empty).toBe(true);
    expect(out.claims).toHaveLength(0);
    expect(out.notes.join()).toContain("extract model failed");
  });

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
    expect(out.brief?.degraded).toContain("summary model failed");
  });

  it("builds an evidence-only brief when there are no claims: degraded, sources linked, gaps as questions", async () => {
    const ports = fakePorts();
    const ctx = baseContext({
      sources: [...sources, s("g1", "https://api.github.com/users/someone", "someone"), s("m1", "https://github.com/jdvorakova/repo", "repo")],
      candidates: [
        { id: "c2", run_id: "run-1", name: "Jana", profile_urls: ["https://github.com/jdvorakova"], anchor_match: null, score: 0.9, decision: "merge", platform: "github", handle: null, snippet: "", reasons: [] },
        { id: "c3", run_id: "run-1", name: "Jana", profile_urls: [sources[2]?.url ?? ""], anchor_match: null, score: 0.1, decision: "rejected", platform: "linkedin", handle: null, snippet: "", reasons: [] },
      ],
      gaps: [
        { run_id: "run-1", question_id: "github_profile", reason: "no public GitHub profile found" },
        { run_id: "run-1", question_id: "tiktok_profile", reason: "not searched: no confirmed handle or id to look up" },
      ],
    });
    // fixture sources use the SERP actor except the two added ones; make those non-SERP
    // the merged profile's repo was fetched for that handle (identity merged); the name-search user stays unverified
    const nonSerp = ctx.sources.map((x) =>
      x.id === "g1" || x.id === "m1" ? { ...x, actor: "rest/github", identity: x.id === "m1" ? ("merged" as const) : ("unverified" as const) } : x,
    );
    const out = await synthesizeBrief({ ...ctx, sources: nonSerp }, ports);
    const brief = out.brief;
    expect(ports.calls.llm).toHaveLength(0);
    expect(brief?.degraded).toContain("no verified claims");
    expect(brief?.per_question.every((p) => p.coverage === "none" && p.summary.startsWith("AI summary unavailable"))).toBe(true);
    expect(brief?.evidence.map((e) => e.url)).toEqual([sources[0]?.url, sources[1]?.url, "https://github.com/jdvorakova/repo"]);
    expect(brief?.also_found.map((e) => e.url)).toEqual(["https://api.github.com/users/someone"]);
    expect(brief?.not_searched[0]?.reason).toMatch(/^not searched:/);
    expect(brief?.interview_questions.join()).toContain("no public GitHub profile found");
    expect(brief?.interview_questions.join()).not.toContain("not searched");
  });
});

describe("canonicalProfile", () => {
  it("collapses posts, statuses and photos onto the profile they belong to", () => {
    expect(canonicalProfile("https://www.linkedin.com/posts/josef-buryan_groupon-activity-7312840998689103873-C4IV")).toEqual({
      url: "https://www.linkedin.com/in/josef-buryan/",
      handle: "josef-buryan",
    });
    expect(canonicalProfile("https://cz.linkedin.com/in/Luk%C3%A1%C5%A1-pokorn%C3%BD-436438295/cs")).toEqual({
      url: "https://cz.linkedin.com/in/Luk%C3%A1%C5%A1-pokorn%C3%BD-436438295/cs",
      handle: "lukáš-pokorný-436438295",
    });
    expect(canonicalProfile("https://x.com/josefburyan/status/123")).toEqual({ url: "https://x.com/josefburyan", handle: "josefburyan" });
    expect(canonicalProfile("https://www.instagram.com/p/abc/")).toEqual({ url: "https://www.instagram.com/p/abc/", handle: "abc" });
    expect(canonicalProfile("https://www.linkedin.com/pub/dir/Lukas/Pokorny")).toEqual({ url: "https://www.linkedin.com/pub/dir/Lukas/Pokorny", handle: null });
  });
});
