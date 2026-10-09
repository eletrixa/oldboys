/**
 * Profile seam tests: evidence gate, fit math, degraded path, profile carried in the synthesized brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/profile.test.ts
 * Deps:    vitest
 * Tested:  src/recipe/seams/profile.ts, src/recipe/seams/profile-fit.ts, src/recipe/seams/synthesize.ts
 *
 * Key responsibilities:
 * - A quote not inside the named source's excerpt is dropped, and its item with it; drops are counted per section
 * - fit_pct: has 1, partial 0.5, none 0; a trait without supporting evidence counts as none
 * - One fit card for the run's role: brief must-haves weight 2, catalog extras weight 1, none without a role
 * - Questions cut to 5 by priority, then the evidence count of the risk they close
 * - Personality only from the person's own writing; under 3 lines DISC and MBTI are null; big5 passes through the same gate
 * - Every surviving evidence line carries a code-set strength
 * - A failed attempt retries once over the 40 highest-value sources; then a degraded profile, never a thrown step
 * - Prompt forbids score/rating/trust/culture-fit wording and Art. 9 content
 *
 * Design constraints:
 * - Fake llm port only; prompts are routed by their system text
 */
import { describe, expect, it } from "vitest";
import { Brief, type Claim, type Source } from "@/domain/claim";
import { quoteInExcerpt } from "@/domain/quote";
import type { Ports } from "@/domain/ports";
import { buildProfile, fitPct, rankSources, TOO_LITTLE_WRITING, validEvidence } from "@/recipe/seams/profile";
import { fitTraits, topQuestions } from "@/recipe/seams/profile-fit";
import { synthesizeBrief } from "@/recipe/seams/synthesize";
import { baseContext, fakePorts } from "@/recipe/__tests__/fakes";

const src: Source = {
  id: "s1", run_id: "run-1", url: "https://www.linkedin.com/in/jdvorakova", actor: "linkedin", fetched_at: "t",
  excerpt: "Data Engineer at Kiwi.com since 2021. I like shipping small changes every day.", r2_key: "k", expires_at: "e", identity: "merged",
};
const fact: Claim = { id: "c1", run_id: "run-1", question_id: "current-role", candidate_id: null, text: "Data Engineer at Kiwi.com", kind: "FACT", confidence: 0.9, quote: "Data Engineer at Kiwi.com", supports: ["s1"], contradicts: [], rank: 1 };
const good = { quote: "Data Engineer at Kiwi.com since 2021", source_id: "s1", kind: "FACT", supports: true };
const fake = { quote: "Led a team of 40", source_id: "s1", kind: "FACT", supports: true };
const style = { quote: "I like shipping small changes every day", source_id: "s1", kind: "INFERENCE", supports: true };

const facts = {
  achievements: [{ text: "Joined Kiwi.com in 2021", evidence: [good, fake] }, { text: "Led 40 people", evidence: [fake] }],
  risks: [],
  history: [{ organization: "Kiwi.com", title: "Data Engineer", from: "2021", to: null, kind: "job", summary: "", evidence: [good] }],
};
const reading = (personalityEvidence: unknown[]) => ({
  personality: { disc: { type: "C", confidence: "low" }, mbti: null, read: "Prefers small, frequent changes.", evidence: personalityEvidence },
  position_fit: { rationale: "r", traits: [
    { id: "mh-pipelines", status: "has", evidence: [good] },
    { id: "mh-leadership", status: "has", evidence: [fake] },
    { id: "mh-warehouse", status: "partial", evidence: [style] },
    { id: "mh-invented", status: "has", evidence: [good] },
  ] },
  questions: [{ text: "Which pipelines did you own?", closes: "scope of work", priority: 3 }],
});

const llmFor = (r: unknown): Ports["llm"] =>
  ((input: { system: string }) =>
    Promise.resolve({ value: input.system.startsWith("Build the candidate") ? facts : input.system.startsWith("Read the candidate") ? r : [], cost_usd: 0.01 })) as Ports["llm"];
const mustHaves = [
  { id: "current-role", text: "Current role and employer?" },
  { id: "mh-pipelines", title: "Production data pipelines", text: "Built production pipelines?" },
  { id: "mh-leadership", title: "Team leadership", text: "Led a data team?" },
];
const ctx = baseContext({ sources: [src], claims: [fact], questions: mustHaves });
const out = () => ({ calls: 0, cost_usd: 0, notes: [] as string[] });

describe("profile seam", () => {
  it("drops evidence whose quote is not in the named excerpt, and items left without evidence", async () => {
    expect(validEvidence([good, fake, { ...good, source_id: "nope" }] as never, [src])).toEqual([{ ...good, strength: "weak" }]);
    // Own LinkedIn profile: weak; the same quote in press is strong; a first-person press quote is weak and noted
    expect(validEvidence([good] as never, [src])[0]?.strength).toBe("weak");
    const article = { ...src, url: "https://www.e15.cz/x", actor: "apify/website-content-crawler" };
    expect(validEvidence([good, { ...style, kind: "FACT", note: "E15" }, style] as never, [article])).toMatchObject([
      { strength: "strong" },
      { strength: "weak", note: "E15, self-quoted in press" },
      { strength: "weak" },
    ]);
    const o = out();
    const p = await buildProfile(ctx, [fact], fakePorts({ llm: llmFor(reading([style])) }), o);
    expect(p.achievements).toMatchObject([{ text: "Joined Kiwi.com in 2021", evidence: [good] }]);
    expect(p.achievements[0]?.evidence).toHaveLength(1);
    expect(p.history).toHaveLength(1);
    expect(p.degraded).toBeNull();
    expect(o.calls).toBe(2);
    expect(o.cost_usd).toBeCloseTo(0.02);
  });

  it("computes fit_pct: has 1, partial 0.5, unsupported trait counts as none", async () => {
    expect(fitPct([{ status: "has" }, { status: "partial" }, { status: "none" }])).toBe(50);
    expect(fitPct([])).toBe(0);
    expect(fitPct([{ status: "has", weight: 3 }, { status: "none", weight: 1 }])).toBe(75);
    expect(fitPct([{ status: "has", weight: 0 }])).toBe(0);
    const p = await buildProfile(ctx, [fact], fakePorts({ llm: llmFor(reading([style])) }), out());
    expect(p.position_fit).toHaveLength(1);
    const fit = p.position_fit[0];
    expect(fit?.role).toBe("Senior Data Engineer");
    // leadership's only quote fails the check: none; warehouse partial on a supporting line; sql and scale unreported: none
    expect(fit?.traits.map((t) => [t.trait, t.weight, t.status])).toEqual([
      ["Production data pipelines", 2, "has"],
      ["Team leadership", 2, "none"],
      ["Warehouse and lakehouse", 1, "partial"],
      ["SQL and Python", 1, "none"],
      ["Scale and reliability", 1, "none"],
    ]);
    expect(fit?.fit_pct).toBe(36);
    const r = reading([style]);
    const against = { ...r, position_fit: { rationale: "", traits: [{ id: "mh-pipelines", status: "has", evidence: [{ ...good, direction: "contradicts", supports: true }] }] } };
    const c = (await buildProfile(ctx, [fact], fakePorts({ llm: llmFor(against) }), out())).position_fit[0]?.traits[0];
    expect([c?.status, c?.evidence[0]?.supports]).toEqual(["none", false]);
  });

  it("fits only the run's role: brief must-haves weight 2, catalog extras weight 1, nothing without a role", async () => {
    const t = fitTraits(ctx);
    expect(t.map((x) => [x.id, x.weight])).toEqual([["mh-pipelines", 2], ["mh-leadership", 2], ["mh-warehouse", 1], ["mh-sql-python", 1], ["mh-scale", 1]]);
    expect(fitTraits({ role: "Senior Data Engineer", questions: [{ id: "mh-x", title: "SQL and Python", text: "?" }] }).map((x) => x.id)).toEqual(["mh-x", "mh-pipelines", "mh-warehouse", "mh-scale"]);
    expect(fitTraits({ role: "Chief Vibes Officer", questions: mustHaves }).map((x) => x.id)).toEqual(["mh-pipelines", "mh-leadership"]);
    expect(fitTraits({ role: null, questions: mustHaves })).toEqual([]);
    const systems: string[] = [];
    const llm = ((input: { system: string }) => (systems.push(input.system), llmFor(reading([style]))(input as never))) as Ports["llm"];
    const none = await buildProfile({ ...ctx, role: null }, [fact], fakePorts({ llm }), out());
    expect(none.position_fit).toEqual([]);
    expect(systems[1]).toContain("`position_fit`: null.");
  });

  it("keeps the best 5 questions: contradictions, then unverifiable results, then gaps; ties by the risk's evidence", async () => {
    const q = (text: string, priority: number, risk: string | null = null) => ({ text, closes: text, priority, risk });
    expect(topQuestions([q("gap", 3), q("self", 2), q("clash", 1)], () => 0).map((x) => x.text)).toEqual(["clash", "self", "gap"]);
    const risky = {
      ...facts,
      risks: [
        { text: "Thin claim", evidence: [good] },
        { text: "Overlapping jobs", evidence: [good, { ...good, quote: "since 2021" }] },
        { text: "Unverified", evidence: [fake] },
      ],
    };
    const r = reading([style]);
    const asked = { ...r, questions: [
      q("gap a", 3), q("gap b", 3), q("thin", 1, "R1"), q("overlap", 1, "r2"), q("self", 2), q("odd", 7), q("gap c", 3), q("low", -4, "R9"),
    ] };
    const llm = ((input: { system: string }) =>
      Promise.resolve({ value: input.system.startsWith("Build the candidate") ? risky : asked, cost_usd: 0 })) as Ports["llm"];
    const p = await buildProfile(ctx, [fact], fakePorts({ llm }), out());
    // R3 has no surviving evidence and is dropped, so the model sees R1 and R2 only; "low" clamps to 1 with no risk evidence
    expect(p.risks.map((x) => x.text)).toEqual(["Thin claim", "Overlapping jobs"]);
    expect(p.questions.map((x) => x.text)).toEqual(["overlap", "thin", "low", "self", "gap a"]);
    expect(p.questions[0]).toEqual({ text: "overlap", closes: "overlap" });
  });

  it("counts lines dropped by the quote check per section and never keeps an unverified FACT", async () => {
    const p = await buildProfile(ctx, [fact], fakePorts({ llm: llmFor(reading([style])) }), out());
    expect([p.achievements_dropped, p.risks_dropped, p.history_dropped, p.fit_dropped]).toEqual([2, 0, 0, 1]);
    const lines = [...p.achievements, ...p.history, ...p.position_fit.flatMap((f) => f.traits)].flatMap((x) => x.evidence);
    expect(lines.filter((e) => e.kind === "FACT").every((e) => quoteInExcerpt(e.quote, src.excerpt))).toBe(true);
  });

  it("builds personality only from the person's own writing and nulls types under 3 lines", async () => {
    const post: Source = { ...src, id: "s2", actor: "harvestapi/linkedin-profile-posts", url: "https://www.linkedin.com/posts/jd-1", excerpt: "Shipping beats planning. Small PRs, every day." };
    const press: Source = { ...src, id: "s3", actor: "apify/google-search-scraper", url: "https://news.example/jd", excerpt: "She is a calm leader. We rebuilt the pipeline in a week, she said." };
    const repost: Source = { ...src, id: "s4", actor: "harvestapi/linkedin-profile-posts", url: "https://www.linkedin.com/posts/other-1", excerpt: "Culture eats strategy.", identity: "unverified" };
    const c = baseContext({ sources: [src, post, press, repost], claims: [fact] });
    const line = (quote: string, source_id: string) => ({ quote, source_id, kind: "INFERENCE", supports: true });
    const ownLines = [line("Shipping beats planning", "s2"), line("Small PRs, every day", "s2"), line("We rebuilt the pipeline in a week", "s3")];
    const others = [line("She is a calm leader", "s3"), line("Culture eats strategy", "s4")];
    const rich = await buildProfile(c, [fact], fakePorts({ llm: llmFor(reading([...ownLines, ...others])) }), out());
    expect(rich.personality.evidence.map((e) => e.quote)).toEqual(ownLines.map((e) => e.quote));
    expect(rich.personality.evidence_dropped).toBe(2);
    expect(rich.personality.disc).toEqual({ type: "C", confidence: "low" });
    expect(rich.personality.read).not.toContain(TOO_LITTLE_WRITING);
    const thin = await buildProfile(c, [fact], fakePorts({ llm: llmFor(reading([ownLines[0], ...others, fake])) }), out());
    expect(thin.personality.evidence).toHaveLength(1);
    expect(thin.personality.evidence_dropped).toBe(3);
    expect([thin.personality.disc, thin.personality.mbti]).toEqual([null, null]);
    expect(thin.personality.read).toBe(`Prefers small, frequent changes. ${TOO_LITTLE_WRITING}`);
    const r = reading([]);
    const withTraits = { ...r, personality: { ...r.personality, traits: [{ text: "Ships in small steps", evidence: ownLines }, { text: "Calm", evidence: [others[0]] }] } };
    const rows = await buildProfile(c, [fact], fakePorts({ llm: llmFor(withTraits) }), out());
    expect(rows.personality.traits.map((x) => x.text)).toEqual(["Ships in small steps"]);
    expect(rows.personality.evidence_dropped).toBe(1);
    expect(rows.personality.disc).not.toBeNull();
  });

  it("passes big5 through the gate: a trait with an own-writing quote survives, nothing without one", async () => {
    const post: Source = { ...src, id: "s2", actor: "harvestapi/linkedin-profile-posts", url: "https://www.linkedin.com/posts/jd-1", excerpt: "Shipping beats planning. Small PRs, every day." };
    const press: Source = { ...src, id: "s3", actor: "apify/google-search-scraper", url: "https://news.example/jd", excerpt: "She is a calm leader." };
    const c = baseContext({ sources: [src, post, press], claims: [fact] });
    const line = (quote: string, source_id: string) => ({ quote, source_id, kind: "INFERENCE", supports: true });
    const own = [line("Shipping beats planning", "s2"), line("Small PRs, every day", "s2"), style];
    const trait = (evidence: unknown[]) => ({ dimension: "conscientiousness", lean: "high", position: 80, confidence: "medium", summary: "Ships small.", evidence });
    const r = reading(own);
    const withBig5 = { ...r, personality: { ...r.personality, big5: { traits: [trait([own[0]])], recommendations: [{ text: "Scope tasks small.", dimension: "conscientiousness" }] } } };
    const p = await buildProfile(c, [fact], fakePorts({ llm: llmFor(withBig5) }), out());
    expect(p.personality.big5?.traits).toHaveLength(1);
    expect(p.personality.big5?.recommendations[0]?.text).toBe("Scope tasks small.");
    const other = { ...r, personality: { ...r.personality, big5: { traits: [trait([line("She is a calm leader", "s3")])], recommendations: [] } } };
    expect((await buildProfile(c, [fact], fakePorts({ llm: llmFor(other) }), out())).personality.big5).toBeNull();
    expect((await buildProfile(c, [fact], fakePorts({ llm: llmFor(r) }), out())).personality.big5).toBeNull();
  });

  it("retries once over the 40 highest-value sources when the output does not parse", async () => {
    const press = Array.from({ length: 44 }, (_, i): Source => ({ ...src, id: `p${String(i)}`, actor: "apify/google-search-scraper", url: `https://news.example/${String(i)}`, excerpt: "x" }));
    const c = baseContext({ sources: [...press, src], claims: [fact] });
    expect(rankSources(c.sources)[0]?.id).toBe("p0");
    expect(rankSources([...press, { ...src, actor: "harvestapi/linkedin-profile-scraper" }])[0]?.id).toBe("s1");
    const prompts: string[] = [];
    let first = true;
    const llm = ((input: { system: string; prompt: string }) => {
      prompts.push(input.prompt);
      if (first) {
        first = false;
        return Promise.resolve({ value: { achievements: "truncated" }, cost_usd: 0.01 });
      }
      return llmFor(reading([style]))(input as never);
    }) as Ports["llm"];
    const o = out();
    const p = await buildProfile({ ...c, sources: [{ ...src, actor: "harvestapi/linkedin-profile-scraper" }, ...press] }, [fact], fakePorts({ llm }), o);
    expect(p.degraded).toBeNull();
    expect(o.calls).toBe(2);
    expect(o.notes[0]).toContain("profile retry with top 40 sources");
    const retry = prompts[1] ?? "";
    expect(retry).toContain("[s1]");
    expect(retry).toContain("[p38]");
    expect(retry).not.toContain("[p39]");
  });

  it("forbids score, rating, trust and culture-fit wording and frames personality as working-style inference", async () => {
    const systems: string[] = [];
    const llm = ((input: { system: string }) => {
      systems.push(input.system);
      return llmFor(reading([style]))(input as never);
    }) as Ports["llm"];
    await buildProfile(ctx, [fact], fakePorts({ llm }), out());
    for (const s of systems) {
      expect(s).toContain("Never use the words score, rating, trust or culture fit");
      expect(s).toContain("health, politics, religion, ethnicity, sexuality");
    }
    expect(systems[1]).toContain("working-style inference from the person's own public writing");
  });

  it("degrades on model failure and skips the model with no verified claims", async () => {
    const o = out();
    const p = await buildProfile(ctx, [fact], fakePorts(), o);
    expect(p.degraded).toContain("profile model failed");
    expect(p.achievements).toEqual([]);
    expect(o.calls).toBe(0);
    expect(o.notes).toHaveLength(2);
    const ports = fakePorts();
    expect((await buildProfile(ctx, [], ports, out())).degraded).toBe("no verified claims");
    expect(ports.calls.llm).toHaveLength(0);
  });

  it("is carried in the hiring brief and survives a brief_json round trip", async () => {
    const r = await synthesizeBrief(ctx, fakePorts({ llm: llmFor(reading([style])) }));
    const parsed = Brief.parse(JSON.parse(JSON.stringify(r.brief)));
    expect(parsed.profile?.achievements).toHaveLength(1);
    expect(r.calls).toBe(4);
    expect(Brief.parse({ ...parsed, profile: undefined }).profile).toBeNull();
  });
});
