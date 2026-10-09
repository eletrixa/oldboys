/**
 * Tests for briefStats: fit % and independent evidence count from a stored brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/profile-stats.test.ts
 * Deps:    vitest, ../profile-stats
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Fit from the first position_fit entry; strong lines counted once across sections; null-safe on bad input
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { briefStats } from "../profile-stats";

const ev = (source_id: string, quote: string, strength: "strong" | "weak") => ({ quote, source_id, kind: "FACT", supports: true, strength });
const item = (evidence: unknown[]) => ({ text: "x", evidence });

function brief(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    run_id: "r1",
    profile: {
      achievements: [item([ev("s1", "Led the launch", "strong"), ev("s2", "I built it", "weak")])],
      risks: [item([ev("s3", "Left after a year", "strong")])],
      history: [],
      personality: { disc: null, mbti: null, read: "", traits: [], evidence: [] },
      position_fit: [
        { role: "CMO", fit_pct: 67, rationale: "", traits: [{ trait: "Brand", status: "has", evidence: [ev("s1", "Led the launch", "strong")] }] },
        { role: "Other", fit_pct: 10, rationale: "", traits: [] },
      ],
      questions: [],
      degraded: null,
      ...over,
    },
  });
}

describe("briefStats", () => {
  it("reads the first position fit and counts distinct strong lines across sections", () => {
    expect(briefStats(brief())).toEqual({ fit_pct: 67, independent: 2 });
  });

  it("gives no fit without a position_fit entry", () => {
    expect(briefStats(brief({ position_fit: [] }))).toEqual({ fit_pct: null, independent: 2 });
  });

  it("is null-safe for a missing, malformed or pre-profile brief", () => {
    for (const json of [null, "{broken", JSON.stringify({ run_id: "r1" }), JSON.stringify({ profile: null })]) {
      expect(briefStats(json)).toEqual({ fit_pct: null, independent: 0 });
    }
  });
});
