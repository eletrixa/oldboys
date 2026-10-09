/**
 * Tests for the evidence-on-click helpers: quote deep links, retrieval and kept-until dates, run lookups.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/evidence.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - quoteLink: Text Fragment encoding, textStart,textEnd for long quotes, existing hash, cv: / non-http / empty unchanged
 * - retrievedLabel / keptUntilLabel: UTC, en-GB style, fallbacks
 * - evidenceOf: sources and quote contexts keyed by claim + source
 *
 * Design constraints:
 * - Fixtures stay inline; no real people
 */
import { describe, expect, it } from "vitest";
import { contextKey, evidenceOf, keptUntilLabel, quoteLink, retrievedLabel } from "../evidence";

describe("quoteLink", () => {
  it("adds a Text Fragment for a short quote, percent-encoding spaces, '-', ',' and '&'", () => {
    expect(quoteLink("https://example.com/about", "Built a real-time API, Payments & Billing")).toBe(
      "https://example.com/about#:~:text=Built%20a%20real%2Dtime%20API%2C%20Payments%20%26%20Billing",
    );
  });

  it("uses the first and last four words for a long quote", () => {
    const quote = "Led the platform team of twelve engineers across Prague and Berlin offices";
    expect(quoteLink("https://example.com/", quote)).toBe("https://example.com/#:~:text=Led%20the%20platform%20team,Prague%20and%20Berlin%20offices");
  });

  it("strips surrounding quote marks and collapses whitespace", () => {
    expect(quoteLink("https://example.com/", "  “Senior\n  engineer”  ")).toBe("https://example.com/#:~:text=Senior%20engineer");
  });

  it("appends the directive after an existing fragment", () => {
    expect(quoteLink("https://example.com/page#bio", "data engineer")).toBe("https://example.com/page#bio:~:text=data%20engineer");
    expect(quoteLink("https://example.com/page#:~:text=old", "new")).toBe("https://example.com/page#:~:text=old&text=new");
  });

  it("returns the URL unchanged for the pasted CV, non-http URLs and missing quotes", () => {
    expect(quoteLink("cv:run-1", "data engineer")).toBe("cv:run-1");
    expect(quoteLink("mailto:someone@example.com", "data engineer")).toBe("mailto:someone@example.com");
    expect(quoteLink("not a url", "data engineer")).toBe("not a url");
    expect(quoteLink("https://example.com/", null)).toBe("https://example.com/");
    expect(quoteLink("https://example.com/", "  “”  ")).toBe("https://example.com/");
  });
});

describe("retrievedLabel and keptUntilLabel", () => {
  it("formats in UTC, en-GB style", () => {
    expect(retrievedLabel("2026-10-09T23:14:59.000Z")).toBe("Retrieved 9 Oct 2026, 23:14 UTC");
    expect(retrievedLabel("2026-10-10T01:05:00+02:00")).toBe("Retrieved 9 Oct 2026, 23:05 UTC");
    expect(keptUntilLabel("2026-10-16T23:14:00Z")).toBe("16 Oct 2026");
  });

  it("falls back for missing or invalid dates", () => {
    for (const v of [null, undefined, "", "yesterday"]) {
      expect(retrievedLabel(v)).toBe("Retrieval time not recorded");
      expect(keptUntilLabel(v)).toBeNull();
    }
  });
});

describe("evidenceOf", () => {
  it("indexes sources by id and quote contexts by claim + source", () => {
    const ev = evidenceOf({
      sources: [{ id: "s1", url: "https://example.com/", fetched_at: "2026-10-09T10:00:00Z" }],
      quote_contexts: [{ claim_id: "c1", source_id: "s1", before: "a ", match: "b", after: " c" }],
    });
    expect(ev.sourceOf.get("s1")?.url).toBe("https://example.com/");
    expect(ev.contextOf.get(contextKey("c1", "s1"))).toEqual({ before: "a ", match: "b", after: " c" });
    expect(ev.contextOf.get(contextKey("c1", "s2"))).toBeUndefined();
  });

  it("works for states without quote contexts (older servers)", () => {
    expect(evidenceOf({ sources: [] }).contextOf.size).toBe(0);
  });
});
