/**
 * Tests for which brief sections the report page renders.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/sections.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Sections with no claims and no sources never render; a claimless social presence list is hidden
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import type { BriefSection } from "@/domain/claim";
import { isShown } from "../sections";

const sec = (over: Partial<BriefSection>): BriefSection => ({
  id: "x", title: "X", confidence: 0.5, confidence_reason: "r", claim_ids: [], source_ids: [], summary: "", ...over,
});

describe("isShown", () => {
  it("shows a section with claims", () => {
    expect(isShown(sec({ claim_ids: ["c1"] }))).toBe(true);
  });

  it("hides sections with neither claims nor sources, and a claimless social presence", () => {
    expect(isShown(sec({}))).toBe(false);
    expect(isShown(sec({ id: "contradictions" }))).toBe(false);
    expect(isShown(sec({ id: "social-presence", source_ids: ["s1"] }))).toBe(false);
  });

  it("keeps a source-only platform section", () => {
    expect(isShown(sec({ id: "evidence-github", source_ids: ["s1"] }))).toBe(true);
  });
});
