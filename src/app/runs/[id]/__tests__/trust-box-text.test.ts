/**
 * Tests for the confidence lines in text exports.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/trust-box-text.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - Empty for null; evidence, sources, devil's advocate, identity, one line per check with its links, the note
 * - The missing-figure state names the reason
 *
 * Design constraints:
 * - Pure
 */
import { describe, expect, it } from "vitest";
import { TRUST_BOX_NOTE, type TrustBox } from "../trust-box";
import { trustBoxLines } from "../trust-box-text";

const box: TrustBox = {
  evidence: { pct: 57, facts: 4, inferences: 2, statements: 1, sources: { total: 4, independent: 1, own: 2, mirror: 1 }, challenge: "Devil's advocate: checked 3 findings, 2 held, 1 moved to the interview", unavailable: null },
  identity: { status: "confirmed", label: "Identity matched", counts: "1 account matched", theirs: 1, awaiting: 0, others: 0, supplied: true, reasons: ["name and employer (Snuggs)"] },
  checks: [{ id: "registries", label: "Czech public registries", text: "3 registries searched by name: 2 no record, 1 record under the name.", ask: "Check: ARES, matched by city or company; confirm at the interview.", open: 1, urls: ["https://ares.gov.cz/r/1"] }],
};

describe("trustBoxLines", () => {
  it("is empty for null", () => {
    expect(trustBoxLines(null)).toEqual([]);
  });

  it("lists evidence, sources, the devil's advocate, identity, checks and the note", () => {
    const lines = trustBoxLines(box);
    expect(lines.map((l) => l.text)).toEqual([
      "Verified facts: 57% (4 facts, 2 inferences, 1 statement)",
      "4 sources: 1 independent, 2 own profiles, 1 directory copy",
      "Devil's advocate: checked 3 findings, 2 held, 1 moved to the interview",
      "Identity matched (from the profile link you supplied): 1 account matched. Matched on name and employer (Snuggs).",
      "Czech public registries: 3 registries searched by name: 2 no record, 1 record under the name. Check: ARES, matched by city or company; confirm at the interview.",
      TRUST_BOX_NOTE,
    ]);
    expect(lines[4]?.urls).toEqual(["https://ares.gov.cz/r/1"]);
  });

  it("names the reason when there is no figure", () => {
    const off = { ...box, evidence: { ...box.evidence, pct: null, challenge: null, unavailable: "AI was off for this run." } };
    const lines = trustBoxLines(off);
    expect(lines[0]?.text).toBe("Verified facts: not shown (AI was off for this run.)");
    expect(lines.some((l) => l.text.startsWith("Devil"))).toBe(false);
  });
});
