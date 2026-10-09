/**
 * Tests for the quote context around a claim's quote in its source excerpt (idea #5 "Evidence on click").
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/quote.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - quoteContext: same matching as quoteInExcerpt (case, punctuation, diacritics, whitespace), original characters
 *   returned, word-boundary clipping with "…", null for empty or missing quotes
 * - quoteContexts: only cited sources, deduplicated, a context touching an Art. 9 topic dropped whole (no match either)
 *
 * Design constraints:
 * - Fixtures stay inline; no real people
 */
import { describe, expect, it } from "vitest";
import { quoteContext, quoteContexts, quoteInExcerpt } from "@/domain/quote";

describe("quoteContext", () => {
  it("finds the quote despite case, punctuation and extra whitespace, and returns the original characters", () => {
    const excerpt = "About me:\n  Senior Engineer — Payments,   Prague. Loves Rust.";
    const ctx = quoteContext("senior engineer payments prague", excerpt);
    expect(ctx).toEqual({ before: "About me:\n  ", match: "Senior Engineer — Payments,   Prague", after: ". Loves Rust." });
    expect(quoteInExcerpt("senior engineer payments prague", excerpt)).toBe(true);
  });

  it("keeps diacritics and matches Czech text", () => {
    const ctx = quoteContext("Vývojář v Brně", "Pracuji jako VÝVOJÁŘ v Brně, od roku 2020.");
    expect(ctx?.match).toBe("VÝVOJÁŘ v Brně");
    expect(ctx?.before).toBe("Pracuji jako ");
    expect(ctx?.after).toBe(", od roku 2020.");
    expect(quoteContext("Vyvojar v Brne", "Pracuji jako VÝVOJÁŘ v Brně")).toBeNull();
  });

  it("matches a quote that carries its own punctuation", () => {
    expect(quoteContext("“Built the payments API.”", "I built the payments-API in 2021")).toBeNull();
    expect(quoteContext("“Built the payments API.”", "I built the payments API in 2021")?.match).toBe("built the payments API");
  });

  it("returns null for an empty, punctuation-only or missing quote", () => {
    expect(quoteContext("", "anything")).toBeNull();
    expect(quoteContext("  …!  ", "anything")).toBeNull();
    expect(quoteContext("not here", "anything else")).toBeNull();
  });

  it("clips long surroundings at word boundaries with an ellipsis", () => {
    const excerpt = `alpha bravo charlie delta echo QUOTE HERE foxtrot golf hotel india juliet`;
    const ctx = quoteContext("quote here", excerpt, 12);
    expect(ctx).toEqual({ before: "…delta echo ", match: "QUOTE HERE", after: " foxtrot…" });
  });

  it("does not clip when the excerpt fits within the radius", () => {
    expect(quoteContext("b", "a b c", 160)).toEqual({ before: "a ", match: "b", after: " c" });
  });

  it("cuts exactly at whitespace without dropping a whole word", () => {
    const ctx = quoteContext("mid", "one two mid three four", 6);
    expect(ctx).toEqual({ before: "…two ", match: "mid", after: " three…" });
  });
});

describe("quoteContexts", () => {
  const excerptOf = new Map([
    ["s1", "Works at Acme as a data engineer since 2019."],
    ["s2", "Data engineer at Acme. Member of the local church choir."],
    ["s3", "Data engineer at Acme, says the uncited page."],
  ]);

  it("gives one context per cited source with the quote, never for uncited sources or inferences", () => {
    const out = quoteContexts(
      [
        { id: "c1", quote: "data engineer", supports: ["s1", "s1", "missing"] },
        { id: "c2", quote: null, supports: ["s3"] },
        { id: "c3", quote: "  ", supports: ["s3"] },
      ],
      excerptOf,
    );
    expect(out).toEqual([{ claim_id: "c1", source_id: "s1", before: "Works at Acme as a ", match: "data engineer", after: " since 2019." }]);
  });

  it("drops the whole context, quote included, when the text around it touches an Art. 9 topic", () => {
    const out = quoteContexts([{ id: "c1", quote: "data engineer at acme", supports: ["s2"] }], excerptOf);
    expect(out).toEqual([]);
  });

  it("drops the context when the quote itself is an Art. 9 topic, but keeps the claim's other clean contexts", () => {
    const excerpts = new Map([["h1", "Jan wrote about his health condition last year."], ["s1", "Works at Acme as a data engineer since 2019."]]);
    expect(quoteContexts([{ id: "c1", quote: "health condition", supports: ["h1"] }], excerpts)).toEqual([]);
    expect(quoteContexts([{ id: "c2", quote: "data engineer", supports: ["h1", "s1"] }], excerpts).map((x) => x.source_id)).toEqual(["s1"]);
  });

  it("skips a source whose excerpt does not hold the quote", () => {
    expect(quoteContexts([{ id: "c1", quote: "rust", supports: ["s1"] }], excerptOf)).toEqual([]);
  });
});
