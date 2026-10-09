/**
 * Tests for the confidence card: the figure and its bar, the missing-figure state, the identity line, the check rows with asks
 * and safe links, and the honesty note.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/trust-box-card.test.ts
 * Deps:    vitest, react, react-dom/server
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - Renders nothing for null; "—" with the reason when pct is null; one bar segment per kind present
 * - Unsafe URLs are not linked; the "N to check" pill shows only on rows with an open point; links fold after LINKS_VISIBLE
 *
 * Design constraints:
 * - Static markup only; no hooks in the card
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TRUST_BOX_NOTE, type TrustBox, VERIFIED_MEANS } from "../trust-box";
import { LINKS_VISIBLE, TrustBoxCard } from "../trust-box-card";

const box = (over: Partial<TrustBox> = {}): TrustBox => ({
  evidence: {
    pct: 57,
    facts: 4,
    inferences: 2,
    statements: 1,
    sources: { total: 4, independent: 1, own: 2, mirror: 1 },
    challenge: "Devil's advocate: checked 3 findings, 2 held, 1 moved to the interview",
    unavailable: null,
  },
  identity: {
    status: "confirmed",
    label: "Identity matched",
    counts: "1 account matched · 1 waiting for your answer",
    theirs: 1,
    awaiting: 1,
    others: 0,
    supplied: true,
    reasons: ["name and employer (Snuggs)"],
  },
  checks: [
    { id: "registries", label: "Czech public registries", text: "3 registries searched by name: 2 no record, 1 record under the name.", ask: "Check: ARES, matched by city or company; confirm at the interview.", open: 1, urls: ["https://ares.gov.cz/r/1", "javascript:alert(1)"] },
    { id: "empty", label: "Searched, nothing found", text: "1 source answered with nothing for this person: GitHub.", ask: null, open: 0, urls: [] },
  ],
  ...over,
});

const html = (b: TrustBox | null): string => renderToStaticMarkup(createElement(TrustBoxCard, { box: b }));

describe("TrustBoxCard", () => {
  it("renders nothing for null", () => {
    expect(html(null)).toBe("");
  });

  it("shows the figure, the bar, the sources, the identity line, the rows and the note", () => {
    const out = html(box());
    expect(out).toContain("Confidence in this brief");
    expect(out).toContain("57%");
    expect(out).toContain("57 percent of the findings in this brief are verified facts");
    expect(out).toContain("of the findings in this brief are </span>verified facts");
    expect(out).toContain("4 sources: 1 independent, 2 own profiles, 1 directory copy");
    expect(out).toContain("Devil&#x27;s advocate: checked 3 findings");
    expect((out.match(/pf-bar/g) ?? []).length).toBe(3);
    expect(out).toContain("Said in a call");
    expect(out).toContain("Identity matched");
    expect(out).toContain("from the profile link you supplied");
    expect(out).toContain("Matched on name and employer (Snuggs).");
    expect(out).toContain(VERIFIED_MEANS.replace("'", "&#x27;"));
    expect(out).toContain("Czech public registries");
    expect(out).toContain("1 to check");
    expect(out).toContain("Check: ARES, matched by city or company; confirm at the interview.");
    expect(out).toContain('href="https://ares.gov.cz/r/1"');
    expect(out).not.toContain("javascript:");
    expect(out).toContain(TRUST_BOX_NOTE.replace("'", "&#x27;"));
  });

  it("shows a dash and the reason when there is no figure, and no bar segment without findings", () => {
    const out = html(box({ evidence: { pct: null, facts: 0, inferences: 0, statements: 0, sources: { total: 0, independent: 0, own: 0, mirror: 0 }, challenge: null, unavailable: "AI was off for this run: no finding was read or double-checked by a model, so there is no verified share to show." } }));
    expect(out).toContain("—");
    expect(out).toContain("AI was off for this run");
    expect(out).toContain("No source was kept.");
    expect(out).not.toContain("pf-bar");
    expect(out).not.toContain("Finding kinds");
    expect(out).not.toContain("of the findings in this brief are </span>");
  });

  it("folds links past LINKS_VISIBLE behind Show all", () => {
    const urls = Array.from({ length: LINKS_VISIBLE + 2 }, (_, i) => `https://r${String(i)}.example/x`);
    const out = html(box({ checks: [{ id: "registries", label: "Czech public registries", text: "t", ask: null, open: 0, urls }] }));
    expect(out).toContain("Show all (2 more)");
    expect((out.match(/href="https:\/\/r\d\.example/g) ?? []).length).toBe(LINKS_VISIBLE + 2);
  });

  it("marks the identity state and keeps the rows list out when there are no checks", () => {
    const out = html(box({ identity: { status: "open", label: "Identity not yet confirmed", counts: "2 waiting for your answer", theirs: 0, awaiting: 2, others: 0, supplied: false, reasons: [] }, checks: [] }));
    expect(out).toContain("bg-unsure-bg");
    expect(out).toContain("Identity not yet confirmed");
    expect(out).not.toContain("profile link you supplied");
    expect(out).not.toContain("Matched on");
    expect(out).not.toContain("Czech public registries");
  });
});
