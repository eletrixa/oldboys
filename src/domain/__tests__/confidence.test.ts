/**
 * Tests for the deterministic section confidence: drivers, caps, contradiction penalty and the reason sentence.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/confidence.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - sourceOrigin: self profiles, mirror aggregators, independent pages, the candidate's own site via profile URLs,
 *   a pasted CV (non-http URL or actor "cv") as self
 * - Mirrors never raise the count; self-only caps at 0.75, one independent at 0.85, two independent reach 0.95
 * - One source caps at 0.6, no merged source 0.5, inference-only 0.4, a contradiction lowers by 0.2
 * - The reason is one plain sentence a hiring manager understands
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { sectionConfidence, sourceOrigin, type SectionCounts } from "@/domain/confidence";

const counts = (over: Partial<SectionCounts> = {}): SectionCounts => ({
  claims: 2, facts: 2, inferences: 0, sources: 2, confirmed_sources: 2, contradictions: 0, self_sources: 0, mirror_sources: 0, independent_sources: 2, ...over,
});

describe("sourceOrigin", () => {
  it("calls the subject's own profiles and posts self", () => {
    for (const u of ["https://www.linkedin.com/in/jana", "https://linkedin.com/posts/jana_x", "https://x.com/jana", "https://www.instagram.com/jana", "https://facebook.com/jana"]) {
      expect(sourceOrigin(u)).toBe("self");
    }
  });

  it("calls aggregators mirror", () => {
    for (const u of ["https://rocketreach.co/jana-profile", "https://www.bloomberg.com/profile/person/123", "https://theorg.com/org/x/jana", "https://www.zoominfo.com/p/Jana",
      "https://signalhire.com/profiles/jana", "https://www.apollo.io/people/jana", "https://www.crunchbase.com/person/jana", "https://contactout.com/jana", "https://lusha.com/jana"]) {
      expect(sourceOrigin(u)).toBe("mirror");
    }
  });

  it("calls press, employer pages and other bloomberg or linkedin pages independent", () => {
    for (const u of ["https://www.bloomberg.com/news/articles/x", "https://www.linkedin.com/company/acme", "https://acme.com/team", "https://podcast.example/ep1", "not a url"]) {
      expect(sourceOrigin(u)).toBe("independent");
    }
  });

  it("calls a host of the merged profile URLs self, but only the same handle on shared platforms", () => {
    const profiles = ["https://jana.dev/", "https://github.com/jana"];
    expect(sourceOrigin("https://jana.dev/about", profiles)).toBe("self");
    expect(sourceOrigin("https://github.com/jana/repo", profiles)).toBe("self");
    expect(sourceOrigin("https://github.com/other/repo", profiles)).toBe("independent");
    expect(sourceOrigin("https://jana.dev/about")).toBe("independent");
  });

  it("calls a pasted CV (non-http URL or actor cv) self", () => {
    expect(sourceOrigin("cv:run-1")).toBe("self");
    expect(sourceOrigin("https://example.com/cv.pdf", [], "cv")).toBe("self");
    expect(sourceOrigin("https://example.com/cv.pdf", [], "web")).toBe("independent");
  });
});

describe("sectionConfidence", () => {
  it("scores two facts from two independent sources high and says why", () => {
    expect(sectionConfidence(counts())).toEqual({ confidence: 0.9, confidence_reason: "Confirmed by 2 independent sources" });
  });

  it("raises with a third independent source and never passes 0.95", () => {
    expect(sectionConfidence(counts({ sources: 3, confirmed_sources: 3, independent_sources: 3 })).confidence).toBe(0.95);
    expect(sectionConfidence(counts({ sources: 9, confirmed_sources: 9, independent_sources: 9 })).confidence).toBe(0.95);
  });

  it("does not let mirrors raise a self-reported section: LinkedIn plus two mirrors stays at the single-source cap", () => {
    const r = sectionConfidence(counts({ claims: 1, facts: 1, sources: 3, confirmed_sources: 3, self_sources: 1, mirror_sources: 2, independent_sources: 0 }));
    expect(r).toEqual({ confidence: 0.6, confidence_reason: "Self-reported; a mirror site repeats it" });
  });

  it("caps self-reported sources at 0.75 and says so", () => {
    const r = sectionConfidence(counts({ sources: 3, confirmed_sources: 3, self_sources: 3, independent_sources: 0 }));
    expect(r).toEqual({ confidence: 0.75, confidence_reason: "Self-reported only" });
  });

  it("lifts the cap with one independent source and reaches 0.95 with two", () => {
    const one = sectionConfidence(counts({ sources: 3, confirmed_sources: 3, self_sources: 2, independent_sources: 1 }));
    expect(one).toEqual({ confidence: 0.85, confidence_reason: "Self-reported, plus one independent source" });
    expect(sectionConfidence(counts({ sources: 4, confirmed_sources: 4, self_sources: 2, independent_sources: 2 })).confidence).toBe(0.95);
  });

  it("caps a single independent source at 0.6", () => {
    const r = sectionConfidence(counts({ claims: 1, facts: 1, sources: 1, confirmed_sources: 1, independent_sources: 1 }));
    expect(r).toEqual({ confidence: 0.6, confidence_reason: "Single independent source, not corroborated" });
  });

  it("caps at 0.5 when no supporting source is confirmed", () => {
    const r = sectionConfidence(counts({ confirmed_sources: 0 }));
    expect(r.confidence).toBe(0.5);
    expect(r.confidence_reason).toBe("Not confirmed as the same person");
  });

  it("caps inference-only sections at 0.4", () => {
    const r = sectionConfidence(counts({ facts: 0, inferences: 2, sources: 3, confirmed_sources: 3, independent_sources: 3 }));
    expect(r).toEqual({ confidence: 0.4, confidence_reason: "Inferred, no verbatim quote" });
  });

  it("lowers by 0.2 on a contradiction and appends 'sources disagree' only then", () => {
    const r = sectionConfidence(counts({ contradictions: 1 }));
    expect(r.confidence).toBe(0.7);
    expect(r.confidence_reason).toBe("Confirmed by 2 independent sources; sources disagree");
    expect(sectionConfidence(counts()).confidence_reason).not.toContain("disagree");
  });

  it("scores a source-only section low and never below 0", () => {
    expect(sectionConfidence(counts({ claims: 0, facts: 0, sources: 2, confirmed_sources: 2 }))).toEqual({
      confidence: 0.4,
      confidence_reason: "Listed for reference; no claim relies on it",
    });
    expect(sectionConfidence(counts({ claims: 1, facts: 0, inferences: 1, sources: 0, confirmed_sources: 0, independent_sources: 0, contradictions: 3 })).confidence).toBe(0.1);
  });
});
