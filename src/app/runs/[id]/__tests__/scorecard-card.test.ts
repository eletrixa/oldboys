/**
 * Tests for the scorecard card: figure and bar, both columns, points labels, source links (CV as text, unsafe URLs as text),
 * ask lines, the fold after VISIBLE lines, empty states and the honesty note.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/scorecard-card.test.ts
 * Deps:    vitest, react, react-dom/server
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - Renders nothing for null or an empty card; "—" with "no must-haves to score" when only lines exist
 * - pointsLabel / checkedLabel wording; open points sit under OPEN_POINTS_LABEL once, with no per-line label
 *
 * Design constraints:
 * - Static markup only; no hooks in the card
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Evidence } from "../evidence";
import { checkedLabel, pointsLabel, SCORECARD_NOTE, type ScoreItem, type Scorecard } from "../scorecard";
import { CHECKS_TITLE, OPEN_POINTS_LABEL, ScorecardCard, VISIBLE } from "../scorecard-card";

const evidence: Evidence = {
  sourceOf: new Map([
    ["s-gh", { url: "https://github.com/jnovak" }],
    ["cv:r", { url: "cv:r" }],
  ]),
  contextOf: new Map(),
  challengeOf: new Map(),
};

const item = (over: Partial<ScoreItem>): ScoreItem => ({ id: "x", side: "plus", area: "must-have", weight: 3, text: "Production SQL", kind: "FACT", points: 38, source_ids: ["s-gh"], urls: [], ask: null, ...over });

const card = (over: Partial<Scorecard> = {}): Scorecard => ({
  fit: 75,
  role: "Senior Data Engineer",
  checked: { evidenced: 2, partial: 1, none: 1, total: 4 },
  pluses: [item({ id: "p1" }), item({ id: "p2", area: "cv", weight: null, text: "1 CV statement matches the public record", kind: "CHECK", points: 0, source_ids: ["cv:r"] })],
  minuses: [
    item({ id: "m1", side: "minus", weight: 1, text: "Led a team of three: no public evidence", kind: "CHECK", points: -13, source_ids: [], ask: "Where would we see it?" }),
    item({ id: "m2", side: "minus", area: "risk", weight: null, text: "Three employers in four years", kind: "INFERENCE", points: 0, source_ids: ["s-gh"] }),
  ],
  checks: [
    item({ id: "c1", side: "check", area: "signal", weight: null, text: "All public repositories are forks.", kind: "CHECK", points: 0, source_ids: [], urls: ["javascript:alert(1)"], ask: "Did you have an earlier account?" }),
    item({ id: "c2", side: "check", area: "registry", weight: null, text: "ARES: Jan Novák, Brno", kind: "CHECK", points: 0, source_ids: [], urls: ["https://ares.gov.cz/r/1"], ask: "Check: matched by city: Brno." }),
  ],
  notes: ["1 source was not searched."],
  ...over,
});

const html = (c: Scorecard | null): string => renderToStaticMarkup(createElement(ScorecardCard, { card: c, evidence }));

describe("ScorecardCard", () => {
  it("renders nothing for null or an empty card", () => {
    expect(html(null)).toBe("");
    expect(html(card({ fit: null, pluses: [], minuses: [], checks: [] }))).toBe("");
  });

  it("shows the figure, role, counts, both columns, labels, links and the note", () => {
    const out = html(card());
    expect(out).toContain("75%");
    expect(out).toContain("Senior Data Engineer");
    expect(out).toContain("2 of 4 must-haves evidenced, 1 partly");
    expect(out).toContain("+38 pts");
    expect(out).toContain("weight 3");
    expect(out).toContain(CHECKS_TITLE);
    expect(out).toContain("Ask: Where would we see it?");
    expect(out).toContain("−13 pts");
    expect(out).not.toContain(">no effect on fit<");
    expect(out.split(OPEN_POINTS_LABEL).length).toBe(3);
    expect(out).toContain('href="https://github.com/jnovak"');
    expect(out).toContain('href="https://ares.gov.cz/r/1"');
    expect(out).not.toContain("javascript:");
    expect(out).toContain("Candidate&#x27;s CV (pasted)");
    expect(out).toContain("Ask: Did you have an earlier account?");
    expect(out).toContain("Check: matched by city: Brno.");
    expect(out).toContain("1 source was not searched.");
    expect(out).toContain("not a judgement of the person");
    expect(SCORECARD_NOTE).toContain("not a judgement of the person");
  });

  it("prints a dash when there is nothing to score but lines exist", () => {
    const out = html(card({ fit: null, checked: { evidenced: 0, partial: 0, none: 0, total: 0 }, pluses: [], checks: [] }));
    expect(out).toContain("—");
    expect(out).toContain("no must-haves to score");
    expect(out).toContain("No must-have has public evidence yet.");
  });

  it("folds lines past VISIBLE behind Show all", () => {
    const many = Array.from({ length: VISIBLE + 3 }, (_, i) => item({ id: `p${String(i)}`, text: `Line ${String(i)}` }));
    const out = html(card({ pluses: many }));
    expect(out).toContain("Show all (3 more)");
    expect(out).toContain(`Line ${String(VISIBLE + 2)}`);
  });
});

describe("labels", () => {
  it("pointsLabel", () => {
    expect(pointsLabel(14)).toBe("+14 pts");
    expect(pointsLabel(-14)).toBe("−14 pts");
    expect(pointsLabel(0)).toBe("no effect on fit");
  });
  it("checkedLabel", () => {
    expect(checkedLabel({ evidenced: 1, partial: 0, none: 0, total: 1 })).toBe("1 of 1 must-have evidenced");
    expect(checkedLabel({ evidenced: 0, partial: 0, none: 0, total: 0 })).toBe("no must-haves to score");
  });
});
