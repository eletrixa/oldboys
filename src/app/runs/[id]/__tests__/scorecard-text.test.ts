/**
 * Tests for the scorecard kit lines: header line, signed item lines with kind, points, CV marker and ask, notes, honesty line.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/scorecard-text.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - [] for null or an empty card; URLs resolved through urlOf, CV sources named not linked
 *
 * Design constraints:
 * - Pure
 */
import { describe, expect, it } from "vitest";
import { SCORECARD_NOTE, type Scorecard } from "../scorecard";
import { scorecardLines } from "../scorecard-text";

const card: Scorecard = {
  fit: 75,
  role: "Senior Data Engineer",
  checked: { evidenced: 2, partial: 1, none: 1, total: 4 },
  pluses: [{ id: "p", side: "plus", area: "must-have", weight: 3, text: "Production SQL", kind: "FACT", points: 38, source_ids: ["s-gh", "cv:r"], urls: [], ask: null }],
  minuses: [],
  checks: [{ id: "m", side: "check", area: "registry", weight: null, text: "ARES: Jan Novák, Brno", kind: "CHECK", points: 0, source_ids: [], urls: ["https://ares.gov.cz/r/1"], ask: "Check: matched by city: Brno." }],
  notes: ["1 source was not searched."],
};
const urlOf = (id: string): string | null => ({ "s-gh": "https://github.com/jnovak", "cv:r": "cv:r" })[id] ?? null;

describe("scorecardLines", () => {
  it("is empty for null or an empty card", () => {
    expect(scorecardLines(null, urlOf)).toEqual([]);
    expect(scorecardLines({ ...card, fit: null, pluses: [], minuses: [], checks: [] }, urlOf)).toEqual([]);
  });

  it("writes the header, signed lines with their links, notes and the honesty line", () => {
    const lines = scorecardLines(card, urlOf);
    expect(lines[0]).toEqual({ text: "Fit, Senior Data Engineer: 75% (2 of 4 must-haves evidenced, 1 partly)", urls: [] });
    expect(lines[1]).toEqual({ text: "+ Production SQL [FACT, +38 pts, weight 3] (Candidate's CV (pasted))", urls: ["https://github.com/jnovak"] });
    expect(lines[2]?.text).toBe("Checked, unresolved (not a minus):");
    expect(lines[3]).toEqual({ text: "? ARES: Jan Novák, Brno [CHECK, no effect on fit] Check: matched by city: Brno.", urls: ["https://ares.gov.cz/r/1"] });
    expect(lines[4]?.text).toBe("1 source was not searched.");
    expect(lines[5]?.text).toBe(SCORECARD_NOTE);
  });
});
