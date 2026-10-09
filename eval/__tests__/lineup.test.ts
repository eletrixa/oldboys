/**
 * Simulated recruiter in the eval harness: answers only where the product would ask, from the ground truth.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/__tests__/lineup.test.ts
 * Deps:    vitest, eval/harness (lineup), eval/personas (p1 ground truth)
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - No pause (a merge exists): nothing asked, nothing changed, in both modes
 * - Pause (nothing merged): questionsToAsk picks the questions; own profile -> merge, namesake -> rejected,
 *   unknown -> possibly-same-as; an auto-rejected candidate and one beyond the cap keep their decision
 * - The answer re-marks the source identity the way applySourceIdentity does; strict mode answers nothing
 *
 * Design constraints:
 * - The personas all start from a profile or CV (never paused), so this exercises the answer path directly
 */
import { describe, expect, it } from "vitest";
import type { Candidate, Source } from "@/domain/claim";
import type { StepContext } from "@/recipe/sources/types";
import { lineup } from "../harness";
import { PERSONAS } from "../personas";

const p1 = PERSONAS.find((p) => p.id === "p1-data-engineer");
if (p1 === undefined) throw new Error("p1 persona missing");
const own = (note: string): string => p1.truth.profiles.find((x) => x.note === note && x.person)?.url ?? "";
const namesake = (note: string): string => p1.truth.profiles.find((x) => x.note === note && !x.person)?.url ?? "";

const GH = own("own GitHub");
const TALK = own("own meetup talk page");
const LI_NAMESAKE = namesake("LinkedIn accountant in Ostrava");
const GH_NAMESAKE = namesake("GitHub account in Ostrava");
const UNKNOWN = "https://x.com/evalp-unknown";

function cand(id: string, url: string, platform: string, decision: Candidate["decision"], score: number): Candidate {
  return { id, run_id: "r", name: "Alena Vymyšlená", profile_urls: [url], anchor_match: null, score, decision, platform, handle: null, snippet: "", reasons: [] };
}

function src(id: string, url: string): Source {
  return { id, run_id: "r", url, actor: "apify/google-search-scraper", fetched_at: "t", excerpt: "", r2_key: "k", expires_at: "t", identity: "unverified" };
}

function ctx(candidates: Candidate[]): StepContext {
  return {
    runId: "r",
    subject: "Alena Vymyšlená",
    anchor: "Brno",
    goal: "hiring",
    role: "Data Engineer",
    roleFamily: null,
    roleSites: [],
    questions: [],
    candidates,
    sources: [src("s-gh", GH), src("s-ns", GH_NAMESAKE), src("s-talk", TALK)],
    claims: [],
    gaps: [],
    budget: { usd: 1, calls: 10 },
    spent: { usd: 0, calls: 0 },
  };
}

const decisions = (c: StepContext): Record<string, Candidate["decision"]> => Object.fromEntries(c.candidates.map((x) => [x.id, x.decision]));
const identity = (c: StepContext): Record<string, Source["identity"]> => Object.fromEntries(c.sources.map((x) => [x.id, x.identity]));

describe("eval lineup (simulated recruiter)", () => {
  it("asks nothing when a candidate is merged (the run does not pause)", () => {
    const start = ctx([cand("li", "https://www.linkedin.com/in/evalp-alena-vymyslena/", "linkedin", "merge", 1), cand("gh", GH, "github", "possibly-same-as", 0.7)]);
    for (const mode of ["recruiter", "strict"] as const) {
      const { ctx: after, record } = lineup(p1, start, [], mode);
      expect(record).toEqual({ paused: false, questions: [], leftOpen: [] });
      expect(after).toBe(start);
    }
  });

  it("answers what the product asks from the truth and leaves auto decisions and unasked profiles alone", () => {
    const start = ctx([
      cand("li-ns", LI_NAMESAKE, "linkedin", "rejected", 0.2),
      cand("gh", GH, "github", "possibly-same-as", 0.7),
      cand("gh-ns", GH_NAMESAKE, "github", "possibly-same-as", 0.6),
      cand("talk", TALK, "web", "possibly-same-as", 0.6),
      cand("x", UNKNOWN, "x", "possibly-same-as", 0.5),
    ]);
    const { ctx: after, record } = lineup(p1, start, [], "recruiter");
    expect(record.paused).toBe(true);
    // One question per platform: the best GitHub row wins; the web hit is not shown while 2 profile platforms fit the cap
    expect(record.questions.map((q) => [q.url, q.truth, q.answer])).toEqual([
      [GH, "own", "merge"],
      [UNKNOWN, "unknown", "possibly-same-as"],
      [TALK, "own", "merge"],
    ]);
    expect(record.leftOpen).toEqual([GH_NAMESAKE]);
    expect(decisions(after)).toEqual({ "li-ns": "rejected", gh: "merge", "gh-ns": "possibly-same-as", talk: "merge", x: "possibly-same-as" });
    expect(identity(after)).toEqual({ "s-gh": "merged", "s-ns": "unverified", "s-talk": "merged" });
  });

  it("answers a namesake with no and keeps its pages unconfirmed", () => {
    const start = ctx([cand("gh-ns", GH_NAMESAKE, "github", "possibly-same-as", 0.6)]);
    const { ctx: after, record } = lineup(p1, start, [], "recruiter");
    expect(record.questions.map((q) => [q.truth, q.answer])).toEqual([["namesake", "rejected"]]);
    expect(decisions(after)).toEqual({ "gh-ns": "rejected" });
    expect(identity(after)["s-ns"]).toBe("unverified");
  });

  it("strict mode records the same questions and answers none", () => {
    const start = ctx([cand("gh", GH, "github", "possibly-same-as", 0.7), cand("talk", TALK, "web", "possibly-same-as", 0.6)]);
    const { ctx: after, record } = lineup(p1, start, [], "strict");
    expect(record.questions.map((q) => [q.url, q.answer])).toEqual([[GH, null], [TALK, null]]);
    expect(after).toBe(start);
  });
});
