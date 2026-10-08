/**
 * Tests for the run view's pure helpers: which candidates get the lineup questions, which texts are role criteria.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/state.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - questionsToAsk: one question per platform, web hits only as filler
 * - roleCriteria: mh- questions only
 * - evidenceGroup: platform label from the URL, step label or "Web search" for plain pages
 * - searchedTitle: "nothing confirmed" once a namesake-only gap is present
 *
 * Design constraints:
 * - Pure: no React, no fetch
 */
import { describe, expect, it } from "vitest";
import type { Candidate } from "@/domain/claim";
import { evidenceGroup, questionsToAsk, roleCriteria, searchedTitle } from "../state";

const cand = (id: string, platform: string, score: number, decision: Candidate["decision"] = "possibly-same-as"): Candidate => ({
  id, run_id: "r", name: "x", profile_urls: [`https://${id}`], anchor_match: null, score, decision, platform, handle: id, snippet: "", reasons: [],
});

describe("questionsToAsk", () => {
  it("asks the best open profile per platform, so three questions reach three platforms", () => {
    const picked = questionsToAsk(
      [cand("li-low", "linkedin", 0.4), cand("li-high", "linkedin", 0.6), cand("ig", "instagram", 0.5), cand("yt", "youtube", 0.5), cand("web", "web", 0.7), cand("x", "x", 0.5, "merge")],
      3,
    );
    expect(picked.map((c) => c.id)).toEqual(["li-high", "ig", "yt"]);
  });
  it("fills with web hits only when fewer profile platforms are open", () => {
    const picked = questionsToAsk([cand("li1", "linkedin", 0.6), cand("li2", "linkedin", 0.5), cand("w1", "web", 0.4), cand("w2", "web", 0.6)], 3);
    expect(picked.map((c) => c.id)).toEqual(["li1", "w2", "w1"]);
  });
});

describe("roleCriteria", () => {
  it("keeps role must-haves only; base research prompts are never criteria", () => {
    const qs = [
      { id: "current-role", text: "What is the subject's current role and employer?" },
      { id: "mh-title-experience", text: "Has held a Senior Data Engineer position or equivalent" },
    ];
    expect(roleCriteria(qs)).toEqual(["Has held a Senior Data Engineer position or equivalent"]);
    expect(roleCriteria(qs.slice(0, 1))).toEqual([]);
  });
});

describe("evidenceGroup", () => {
  it("groups by the URL's platform, not the actor that found it", () => {
    const serp = "apify/google-search-scraper";
    const labels = { [serp]: "Web search", "ares/ekonomicke-subjekty/vyhledat": "ARES registry" };
    expect(evidenceGroup({ step: serp, url: "https://cz.linkedin.com/in/josef-buryan" }, labels)).toBe("LinkedIn");
    expect(evidenceGroup({ step: serp, url: "https://x.com/jb" }, labels)).toBe("X");
    expect(evidenceGroup({ step: serp, url: "https://www.fiba.basketball/player/1" }, labels)).toBe("Web search");
    expect(evidenceGroup({ step: "ares/ekonomicke-subjekty/vyhledat", url: "https://example.cz/firma" }, labels)).toBe("ARES registry");
  });
});

describe("facebook", () => {
  it("is a profile platform: asked about, ranked after bluesky, labelled", () => {
    const picked = questionsToAsk([cand("w", "web", 0.9), cand("fb", "facebook", 0.5), cand("bs", "bluesky", 0.5)], 2);
    expect(picked.map((c) => c.id)).toEqual(["bs", "fb"]);
    expect(evidenceGroup({ step: "apify/google-search-scraper", url: "https://www.facebook.com/jb" })).toBe("Facebook");
  });
});

describe("searchedTitle", () => {
  it("reads 'nothing confirmed' once any gap is namesake-only, else 'nothing found'", () => {
    expect(searchedTitle([{ reason: "no ORCID record found" }])).toBe("Searched, nothing found");
    expect(searchedTitle([{ reason: "no ORCID record found" }, { reason: "hits found, none confirmed (same name, identity not verified)" }])).toBe("Searched, nothing confirmed");
  });
});
