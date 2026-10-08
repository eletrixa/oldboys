/**
 * Tests for the brief sections: which sections exist, their titles, sources and deterministic confidence.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/sections.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - A question gets a section only when it has claims; titles are short, must-haves keep their text
 * - Uncited social profiles get no section; other uncited platforms one section each
 * - Mirror sites do not count as confirmation; the candidate's own site counts as self-reported
 * - Confidence follows the sources' identity (merged) and contradictions; the degraded brief carries the same sections
 *
 * Design constraints:
 * - Fake ports only; no network
 */
import { describe, expect, it } from "vitest";
import type { Claim, Source } from "@/domain/claim";
import { sectionsOf, sectionTitle } from "@/recipe/seams/sections";
import { synthesizeBrief } from "@/recipe/seams/synthesize";
import { baseContext, fakePorts } from "@/recipe/__tests__/fakes";

const src = (id: string, url: string, identity: Source["identity"] = "merged"): Source => ({
  id, run_id: "run-1", url, actor: "a", fetched_at: "t", excerpt: `excerpt ${id}`, r2_key: "k", expires_at: "e", identity,
});
const claim = (id: string, question_id: string, supports: string[], over: Partial<Claim> = {}): Claim => ({
  id, run_id: "run-1", question_id, candidate_id: null, text: `claim ${id}`, kind: "FACT", confidence: 0.9, quote: "q", supports, contradicts: [], rank: 0, ...over,
});
const questions = [
  { id: "current-role", text: "What is the subject's current role and employer?" },
  { id: "public-code", text: "What public code exists?" },
  { id: "mh-sql", text: "Has five years of SQL in production?" },
];
const li = src("s-li", "https://www.linkedin.com/in/jana");
const gh = src("s-gh", "https://github.com/jana");
const site = src("s-web", "https://jana.dev/about");
const press = src("s-press", "https://news.example/jana-profile");
const podcast = src("s-pod", "https://podcast.example/ep1");
const rr = src("s-rr", "https://rocketreach.co/jana");
const bb = src("s-bb", "https://www.bloomberg.com/profile/person/1");
const ig = src("s-ig", "https://www.instagram.com/jana");
const xs = src("s-x", "https://x.com/jana");
const namesake = src("s-ns", "https://example.com/other-jana", "unverified");
const all = [li, gh, site, ig, xs, namesake, press, podcast, rr, bb];
const confirmedOnly = all.filter((s) => s.identity === "merged");
const perQuestion = questions.map((q) => ({ question_id: q.id, coverage: "evidenced" as const, claim_ids: [], summary: `summary ${q.id}` }));

describe("sectionsOf", () => {
  it("gives a section only to questions with claims, plus uncited non-social platforms (GitHub), never a social presence section", () => {
    const claims = [claim("c1", "current-role", ["s-li"]), claim("c2", "current-role", ["s-press"]), claim("c3", "mh-sql", ["s-li"], { kind: "INFERENCE", quote: null })];
    const sections = sectionsOf(questions, claims, perQuestion, all, confirmedOnly);
    expect(sections.map((s) => [s.id, s.title])).toEqual([
      ["current-role", "Current role"],
      ["mh-sql", "Has five years of SQL in production"],
      ["evidence-github", "GitHub"],
    ]);
    expect(sections[0]).toMatchObject({ claim_ids: ["c1", "c2"], source_ids: ["s-li", "s-press"], confidence: 0.85, summary: "summary current-role" });
    expect(sections[0]?.confidence_reason).toBe("Self-reported, plus one independent source");
    expect(sections[1]).toMatchObject({ confidence: 0.3, confidence_reason: "Inferred, no verbatim quote" });
  });

  it("does not count LinkedIn plus RocketReach and Bloomberg as three confirmations", () => {
    const sections = sectionsOf(questions, [claim("c1", "current-role", ["s-li", "s-rr", "s-bb"])], perQuestion, all, confirmedOnly);
    expect(sections[0]).toMatchObject({ confidence: 0.6, confidence_reason: "Self-reported; a mirror site repeats it" });
  });

  it("reaches 0.95 with two independent sources and treats the candidate's own site as self-reported", () => {
    const two = sectionsOf(questions, [claim("c1", "current-role", ["s-li", "s-press", "s-pod"])], perQuestion, all, confirmedOnly);
    expect(two[0]).toMatchObject({ confidence: 0.95, confidence_reason: "Confirmed by 2 independent sources" });
    const own = sectionsOf(questions, [claim("c1", "current-role", ["s-web", "s-li"])], perQuestion, all, confirmedOnly, ["https://jana.dev/"]);
    expect(own[0]).toMatchObject({ confidence: 0.75, confidence_reason: "Self-reported only" });
  });

  it("counts a FACT only from a merged source and lowers on a contradiction", () => {
    const mixed = sectionsOf(questions, [claim("c1", "current-role", ["s-ns"]), claim("c2", "current-role", ["s-li"])], perQuestion, all, confirmedOnly);
    expect(mixed[0]).toMatchObject({ confidence: 0.65, confidence_reason: "Self-reported, plus one independent source" });
    const namesakeOnly = sectionsOf(questions, [claim("c1", "current-role", ["s-ns"])], perQuestion, all, confirmedOnly);
    expect(namesakeOnly[0]).toMatchObject({ confidence: 0.3, confidence_reason: "Inferred, no verbatim quote" });
    const contradicted = sectionsOf(questions, [claim("c1", "current-role", ["s-li", "s-press"], { contradicts: ["s-gh"] })], perQuestion, all, confirmedOnly);
    expect(contradicted[0]?.confidence).toBe(0.65);
    expect(contradicted[0]?.confidence_reason).toBe("Self-reported, plus one independent source; sources disagree");
  });

  it("has no sections when nothing was found", () => {
    expect(sectionsOf(questions, [], perQuestion, [namesake], [])).toEqual([]);
  });
});

describe("sectionTitle", () => {
  it("prefers the model title, then shortens the text without an ellipsis", () => {
    const text = "Has the candidate built or led a multi-function marketing organization (e.g., brand, demand gen, product marketing)?";
    expect(sectionTitle({ id: "mh-x", text, title: "Marketing org leadership" })).toBe("Marketing org leadership");
    expect(sectionTitle({ id: "mh-x", text })).toBe("Has the candidate built or led a multi-function");
    expect(sectionTitle({ id: "mh-x", text: "Has led teams, such as growth, in B2B" })).toBe("Has led teams");
    expect(sectionTitle({ id: "mh-x", text: "Hands-on experience such as SQL" })).toBe("Hands-on experience");
    expect(sectionTitle({ id: "mh-x", text: "a".repeat(120) }).length).toBeLessThanOrEqual(48);
  });

  it("titles the contradictions question 'Where sources disagree'", () => {
    expect(sectionTitle({ id: "contradictions", text: "Do sources disagree?" })).toBe("Where sources disagree");
  });
});

describe("sectionsOf sources", () => {
  it("counts two spellings of one profile as one source", () => {
    const dup = src("s-li2", "https://www.linkedin.com/in/jana/?locale=cs_CZ");
    const sections = sectionsOf(questions, [claim("c1", "current-role", ["s-li", "s-li2"])], perQuestion, [li, dup], [li, dup]);
    expect(sections[0]?.source_ids).toEqual(["s-li"]);
    expect(sections[0]?.confidence).toBe(0.6);
    expect(sections[0]?.confidence_reason).toBe("Self-reported only");
  });

  it("treats a support id outside the run's sources as no source and says so", () => {
    const sections = sectionsOf(questions, [claim("c1", "current-role", ["9b6ea47"], { kind: "INFERENCE", quote: null })], perQuestion, all, confirmedOnly);
    expect(sections[0]?.source_ids).toEqual([]);
    expect(sections[0]?.confidence_reason).toBe("Inferred, no source; a cited source is missing");
  });
});

describe("synthesizeBrief sections", () => {
  it("ships the same deterministic sections when the model is unavailable", async () => {
    const ctx = baseContext({ questions, sources: all, claims: [claim("c1", "current-role", ["s-li"])] });
    const brief = (await synthesizeBrief(ctx, fakePorts())).brief;
    expect(brief?.degraded).not.toBeNull();
    expect(brief?.sections.map((s) => s.id)).toEqual(["current-role", "evidence-github", "evidence-web"]);
    expect(brief?.sections[0]?.confidence).toBe(0.6);
  });
});
