/**
 * Tests for the deterministic section confidence: drivers, caps, contradiction penalty and the reason sentence.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/confidence.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - More facts and more sources raise the score; one source caps at 0.6
 * - No merged source caps at 0.5, inference-only at 0.4, a contradiction lowers by 0.2
 * - The reason names the counts in plain words
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { sectionConfidence, type SectionCounts } from "@/domain/confidence";

const counts = (over: Partial<SectionCounts> = {}): SectionCounts => ({
  claims: 2, facts: 2, inferences: 0, sources: 2, confirmed_sources: 2, contradictions: 0, ...over,
});

describe("sectionConfidence", () => {
  it("scores two facts from two confirmed sources high and says why", () => {
    expect(sectionConfidence(counts())).toEqual({ confidence: 0.9, confidence_reason: "2 facts from 2 confirmed sources, no contradictions" });
  });

  it("raises with a third source and never passes 1", () => {
    expect(sectionConfidence(counts({ sources: 3, confirmed_sources: 3 })).confidence).toBe(1);
    expect(sectionConfidence(counts({ sources: 9, confirmed_sources: 9 })).confidence).toBe(1);
  });

  it("caps a single source at 0.6", () => {
    expect(sectionConfidence(counts({ claims: 1, facts: 1, sources: 1, confirmed_sources: 1 })).confidence).toBe(0.6);
  });

  it("caps at 0.5 when no supporting source is confirmed", () => {
    const r = sectionConfidence(counts({ confirmed_sources: 0 }));
    expect(r.confidence).toBe(0.5);
    expect(r.confidence_reason).toBe("2 facts from 2 sources, none confirmed, no contradictions");
  });

  it("caps inference-only sections at 0.4", () => {
    const r = sectionConfidence(counts({ facts: 0, inferences: 2, sources: 3, confirmed_sources: 3 }));
    expect(r.confidence).toBe(0.4);
    expect(r.confidence_reason).toBe("2 inferences from 3 confirmed sources, no contradictions");
  });

  it("lowers by 0.2 on a contradiction", () => {
    const r = sectionConfidence(counts({ contradictions: 1 }));
    expect(r.confidence).toBe(0.7);
    expect(r.confidence_reason).toContain("1 contradiction");
  });

  it("weighs the fact share and names mixed kinds", () => {
    const r = sectionConfidence(counts({ claims: 4, facts: 2, inferences: 1, sources: 2, confirmed_sources: 1 }));
    expect(r.confidence).toBe(0.65);
    expect(r.confidence_reason).toBe("2 facts, 1 inference, 1 unverified from 2 sources, 1 confirmed, no contradictions");
  });

  it("scores a source-only section low and never below 0", () => {
    expect(sectionConfidence(counts({ claims: 0, facts: 0, sources: 2, confirmed_sources: 2 }))).toEqual({
      confidence: 0.4,
      confidence_reason: "No claims and 2 confirmed sources, no contradictions",
    });
    expect(sectionConfidence(counts({ claims: 1, facts: 0, inferences: 1, sources: 0, confirmed_sources: 0, contradictions: 3 })).confidence).toBe(0.1);
  });
});
