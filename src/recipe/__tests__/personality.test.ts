/**
 * Personality seam tests: the own-writing gate, the Big Five drop rules, the thin-writing floor and the rebuild call.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/personality.test.ts
 * Deps:    vitest
 * Tested:  src/recipe/seams/personality.ts
 *
 * Key responsibilities:
 * - gatePersonality keeps only quote-checked lines from own-writing sources or first-person quotes elsewhere
 * - A Big Five dimension without a surviving quote is dropped; big5 is null under MIN_PERSONALITY_LINES
 * - evidence_dropped counts model lines minus kept lines across evidence, traits and big5
 * - normalisePersonality clamps the model's loose shape: unknown dimension dropped, bad lean balanced, position 0..100, confidence low
 * - readPersonality makes one `primary` call carrying PERSONALITY_PROMPT over a model-shaped answer and throws on a parse failure
 *
 * Design constraints:
 * - Fake llm port only; no I/O
 */
import { describe, expect, it } from "vitest";
import type { Candidate, Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { gatePersonality, MIN_PERSONALITY_LINES, type ModelPersonality, normalisePersonality, PERSONALITY_PROMPT, PersonalityReading, readPersonality, TOO_LITTLE_WRITING } from "@/recipe/seams/personality";
import { fakeLlm } from "@/recipe/__tests__/fakes";

const base = { run_id: "run-1", fetched_at: "t", r2_key: "k", expires_at: "e", identity: "merged" as const };
const post: Source = { ...base, id: "s2", actor: "harvestapi/linkedin-profile-posts", url: "https://www.linkedin.com/posts/jd-1", excerpt: "Shipping beats planning. Small PRs, every day. Reviews before noon." };
const press: Source = { ...base, id: "s3", actor: "apify/google-search-scraper", url: "https://news.example/jd", excerpt: "She is a calm leader. We rebuilt the pipeline in a week, she said." };
const merged: Candidate[] = [];

const line = (quote: string, source_id: string) => ({ quote, source_id, kind: "INFERENCE" as const, supports: true });
const own1 = line("Shipping beats planning", "s2");
const own2 = line("Small PRs, every day", "s2");
const own3 = line("Reviews before noon", "s2");
const firstPerson = line("We rebuilt the pipeline in a week", "s3");
const thirdPerson = line("She is a calm leader", "s3");
const notInExcerpt = line("Led a team of 40", "s2");

const big5Trait = (evidence: unknown[], dimension = "conscientiousness") => ({ dimension, lean: "high", position: 80, confidence: "medium", summary: "Ships small and often.", evidence });
const reading = (over: Record<string, unknown> = {}): PersonalityReading =>
  PersonalityReading.parse({ disc: { type: "C", confidence: "low" }, mbti: { type: "ISTJ", confidence: "low" }, big5: null, read: "Prefers small, frequent changes.", traits: [], evidence: [], ...over });

describe("gatePersonality", () => {
  it("keeps quote-checked lines from own writing or in first person; third-person press lines are dropped", () => {
    const p = gatePersonality(reading({ evidence: [own1, own2, firstPerson, thirdPerson, notInExcerpt] }), [post, press], merged);
    expect(p.evidence.map((e) => e.quote)).toEqual([own1.quote, own2.quote, firstPerson.quote]);
    expect(p.evidence_dropped).toBe(2);
    expect(p.disc).toEqual({ type: "C", confidence: "low" });
    expect(p.read).toBe("Prefers small, frequent changes.");
  });

  it("drops a Big Five dimension without a surviving quote and keeps the recommendations", () => {
    const big5 = { traits: [big5Trait([own3, thirdPerson]), big5Trait([thirdPerson], "extraversion")], recommendations: [{ text: "Give them small scoped tasks.", dimension: "conscientiousness" }] };
    const p = gatePersonality(reading({ evidence: [own1, own2], big5 }), [post, press], merged);
    expect(p.big5?.traits.map((t) => [t.dimension, t.evidence.length])).toEqual([["conscientiousness", 1]]);
    expect(p.big5?.recommendations).toHaveLength(1);
    // kept: 2 evidence + 1 big5 line = 3; model lines: 2 + 3
    expect(p.evidence_dropped).toBe(2);
    const none = gatePersonality(reading({ evidence: [own1, own2, own3], big5: { traits: [big5Trait([thirdPerson])], recommendations: [] } }), [post, press], merged);
    expect(none.big5).toBeNull();
  });

  it("nulls the types and big5 and says so under MIN_PERSONALITY_LINES", () => {
    expect(MIN_PERSONALITY_LINES).toBe(3);
    const big5 = { traits: [big5Trait([own2])], recommendations: [] };
    const p = gatePersonality(reading({ evidence: [own1, thirdPerson], big5 }), [post, press], merged);
    expect(p.evidence).toHaveLength(1);
    expect([p.disc, p.mbti, p.big5]).toEqual([null, null, null]);
    expect(p.read).toBe(`Prefers small, frequent changes. ${TOO_LITTLE_WRITING}`);
    expect(p.evidence_dropped).toBe(1);
  });

  it("never counts a retweet as the person's own writing, even from the X collector", () => {
    const rt: Source = { ...base, id: "s9", actor: "apidojo/tweet-scraper", url: "https://x.com/jd/status/9", excerpt: "RT @someone: Shipping beats planning. Small PRs, every day.\n2024 · 3 likes" };
    const line = { quote: "Shipping beats planning. Small PRs, every day.", source_id: "s9", kind: "INFERENCE" as const, supports: true, direction: "supports" as const, note: "", strength: "weak" as const };
    const p = gatePersonality(reading({ evidence: [line, line, line] }), [post, press, rt], merged);
    expect(p.evidence).toEqual([]);
    expect([p.disc, p.mbti]).toEqual([null, null]);
    expect(p.evidence_dropped).toBe(3);
  });

  it("asks the model for both types whenever own writing is listed; the floor is the gate's", () => {
    expect(PERSONALITY_PROMPT).toContain("Always give both types when at least three lines of their own writing are listed");
    expect(PERSONALITY_PROMPT).toContain("confidence low when the writing is thin");
  });

  it("counts evidence_dropped across evidence, traits and big5", () => {
    const traits = [{ text: "Ships in small steps", evidence: [own1, notInExcerpt] }, { text: "Calm", evidence: [thirdPerson] }];
    const big5 = { traits: [big5Trait([own2, own3, thirdPerson])], recommendations: [] };
    const p = gatePersonality(reading({ evidence: [firstPerson, thirdPerson], traits, big5 }), [post, press], merged);
    expect(p.traits.map((t) => t.text)).toEqual(["Ships in small steps"]);
    // model: 2 + 3 + 3 = 8; kept: 1 + 1 + 2 = 4
    expect(p.evidence_dropped).toBe(4);
    expect(p.evidence.every((e) => e.strength === "weak")).toBe(true);
  });
});

/** Model-side line: `direction` and `note` are required nullable keys, `detail` on rows too. */
const mline = (l: { quote: string; source_id: string }): ModelPersonality["evidence"][number] => ({ ...l, kind: "INFERENCE", supports: true, direction: null, note: null });
const model = (over: Partial<ModelPersonality> = {}): ModelPersonality => ({
  disc: { type: "C", confidence: "low" }, mbti: null, big5: null, read: "Prefers small, frequent changes.", traits: [], evidence: [], ...over,
});

describe("normalisePersonality", () => {
  it("drops an unknown dimension, clamps lean, position and confidence, and fills detail and note", () => {
    const humour = { dimension: "humour", lean: "high", position: -3, confidence: "medium", summary: "s", evidence: [] };
    const big5 = {
      traits: [{ dimension: "conscientiousness", lean: "very", position: 140, confidence: "sure", summary: "s", evidence: [mline(own1)] }, humour],
      recommendations: [{ text: "r", dimension: "humour" }, { text: "r2", dimension: "openness" }],
    };
    const n = normalisePersonality(model({ big5, traits: [{ text: "t", detail: null, evidence: [mline(own2)] }], evidence: [{ ...mline(own3), direction: "contradicts", note: "post" }] }));
    expect(n.big5?.traits).toMatchObject([{ dimension: "conscientiousness", lean: "balanced", position: 100, confidence: "low" }]);
    expect(n.big5?.recommendations.map((r) => r.dimension)).toEqual([null, "openness"]);
    expect(n.traits[0]).toMatchObject({ detail: "", evidence: [{ direction: "supports", note: "", strength: "weak" }] });
    expect(n.evidence[0]).toMatchObject({ direction: "contradicts", note: "post" });
    expect(normalisePersonality(model({ big5: { traits: [{ ...humour, dimension: "openness" }], recommendations: [] } })).big5?.traits[0]?.position).toBe(0);
  });
});

describe("readPersonality", () => {
  const input = { subject: "Jana Dvořáková", anchor: "Brno", role: "Senior Data Engineer", sources: [press, post], merged };

  it("calls the primary model once with the shared prompt and returns the gated read with its cost", async () => {
    const calls: { model: string; system: string; prompt: string }[] = [];
    const answer = model({
      evidence: [own1, own2, thirdPerson].map(mline),
      big5: { traits: [{ dimension: "conscientiousness", lean: "high", position: 80, confidence: "medium", summary: "Ships small and often.", evidence: [mline(own3)] }], recommendations: [] },
    });
    const llm = ((i: { model: string; system: string; prompt: string }) => {
      calls.push(i);
      return fakeLlm(() => ({ personality: answer }))(i as never);
    }) as Ports["llm"];
    const r = await readPersonality(input, llm);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.model).toBe("primary");
    expect(calls[0]?.system).toContain(PERSONALITY_PROMPT);
    expect(calls[0]?.prompt).toContain("Subject: Jana Dvořáková");
    expect(calls[0]?.prompt.indexOf("[s2]")).toBeLessThan(calls[0]?.prompt.indexOf("[s3]") ?? -1);
    expect(r.cost_usd).toBe(0.001);
    expect(r.personality.evidence.map((e) => e.quote)).toEqual([own1.quote, own2.quote]);
    expect(r.personality.big5?.traits).toHaveLength(1);
    expect(r.personality.evidence_dropped).toBe(1);
  });

  it("throws when the model output does not parse", async () => {
    await expect(readPersonality(input, fakeLlm(() => ({ personality: { read: 7 } })))).rejects.toThrow();
  });
});
