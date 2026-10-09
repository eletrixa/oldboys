/**
 * Devil's advocate rules: eligibility and cap, fork pre-check, quote window, reason screen, ledger read-back.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/challenge.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import type { Claim, Source } from "@/domain/claim";
import { CHALLENGE_MAX, NEUTRAL_WHY, challengeEligible, forkPrecheck, quoteSource, quoteWindow, readChallenge, screenWhy } from "@/domain/challenge";
import { CV_QUESTION_ID } from "@/domain/cv-check";

const source = (id: string, excerpt: string, url = `https://github.com/jd/${id}`): Source => ({
  id, run_id: "run-1", url, actor: "rest/github", fetched_at: "2026-10-08T00:00:00.000Z", excerpt, r2_key: "k", expires_at: "e", identity: "merged",
});
const claim = (id: string, over: Partial<Claim> = {}): Claim => ({
  id, run_id: "run-1", question_id: "mh-python", candidate_id: null, text: `Claim ${id}`, kind: "FACT", confidence: 0.8, quote: "etl", supports: ["a"], contradicts: [], rank: 1, ...over,
});

describe("challengeEligible", () => {
  it("takes must-have and CV-check FACTs only, best rank first, then higher confidence", () => {
    const claims = [
      claim("late", { rank: 3 }),
      claim("base", { question_id: "current-role" }),
      claim("inference", { kind: "INFERENCE" }),
      claim("statement", { kind: "STATEMENT" }),
      claim("cv", { question_id: CV_QUESTION_ID, rank: 2 }),
      claim("low", { confidence: 0.6 }),
      claim("high", { confidence: 0.9 }),
    ];
    expect(challengeEligible(claims).map((c) => c.id)).toEqual(["high", "low", "cv", "late"]);
  });

  it("caps at 15", () => {
    const claims = Array.from({ length: 20 }, (_, i) => claim(`c${String(i)}`, { rank: 20 - i }));
    const picked = challengeEligible(claims);
    expect(picked).toHaveLength(CHALLENGE_MAX);
    expect(picked[0]?.id).toBe("c19");
  });
});

describe("forkPrecheck", () => {
  const fork = source("a", "react · forked repository · JavaScript · 0 stars");
  const own = source("b", "etl · Python · 5 stars");
  it("is true only when every cited public source is a fork", () => {
    expect(forkPrecheck(claim("x"), [fork])).toBe(true);
    expect(forkPrecheck(claim("x", { supports: ["a", "b"] }), [fork, own])).toBe(false);
    expect(forkPrecheck(claim("x", { supports: ["b"] }), [own])).toBe(false);
    expect(forkPrecheck(claim("x", { supports: ["ghost"] }), [fork])).toBe(false);
  });
  it("reads 'forked from' too and ignores the CV", () => {
    const page = source("p", "Forked from acme/starter. My notes.", "https://gitlab.com/jd/notes");
    const cv = source("cv", "forked repository", "cv:run-1");
    expect(forkPrecheck(claim("x", { supports: ["p", "cv"] }), [page, cv])).toBe(true);
    expect(forkPrecheck(claim("x", { supports: ["cv"] }), [cv])).toBe(false);
  });
});

describe("quoteSource and quoteWindow", () => {
  it("prefers the public source holding the quote", () => {
    const cv = source("cv", "Maintains etl", "cv:run-1");
    const other = source("o", "nothing here");
    const pub = source("p", "Maintains etl pipelines");
    expect(quoteSource(claim("x", { quote: "Maintains etl", supports: ["cv", "o", "p"] }), [cv, other, pub])?.id).toBe("p");
  });
  it("cuts about 600 characters around the quote", () => {
    const excerpt = `${"word ".repeat(300)}THE QUOTE HERE ${"tail ".repeat(300)}`;
    const w = quoteWindow("the quote here", excerpt);
    expect(w).toContain("THE QUOTE HERE");
    expect(w.length).toBeLessThanOrEqual(600);
    expect(quoteWindow("missing", "short excerpt")).toBe("short excerpt");
    expect(quoteWindow(null, "x".repeat(900))).toHaveLength(600);
  });
});

describe("screenWhy", () => {
  it("keeps a neutral reason about the source", () => {
    expect(screenWhy("tutorial-or-course", " README says it is week 3 of a bootcamp. ")).toBe("README says it is week 3 of a bootcamp.");
  });
  it("replaces judgement, accusation, sensitive traits, empty and overlong reasons", () => {
    for (const why of ["The candidate inflated this", "Looks suspicious", "Plagiarised from a course", "Related to a church project", "", "x".repeat(201)]) {
      expect(screenWhy("fork-or-copy", why)).toBe(NEUTRAL_WHY["fork-or-copy"]);
    }
  });
});

describe("readChallenge", () => {
  const record = { checked: 3, held: 2, challenges: [{ claim_id: "c1", ground: "outdated", why: "Pushed in 2016." }] };
  it("returns the latest record from a ledger ref", () => {
    const rows = [
      { ref_json: JSON.stringify({ challenge: { checked: 1, held: 1, challenges: [] } }) },
      { ref_json: JSON.stringify({ notes: [], challenge: record }) },
      { ref_json: JSON.stringify({ brief: true }) },
    ];
    expect(readChallenge(rows)).toEqual(record);
  });
  it("is null for old runs, bad JSON and malformed records", () => {
    expect(readChallenge([])).toBeNull();
    expect(readChallenge([{ ref_json: null }, { ref_json: "{bad" }, { ref_json: JSON.stringify({ notes: [] }) }])).toBeNull();
    expect(readChallenge([{ ref_json: JSON.stringify({ challenge: { checked: 1, held: 0, challenges: [{ claim_id: "c", ground: "liar", why: "" }] } }) }])).toBeNull();
  });
});
