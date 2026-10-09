/**
 * Tests for the Big Five block of the working-style section: lean text and sentence, pentagon chart, rows, recommendations,
 * evidence prop, own-words evidence states.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/big-five.test.ts
 * Deps:    vitest, react, react-dom/server (static markup, no DOM)
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - leanText / leanLabel: pole word per lean, "balanced" for the middle; leanSentence names leans, balanced and unread dimensions
 * - Chart: role img labelled with the lean sentence, one dot per present dimension (hollow for low confidence), stubs and no
 *   polygon when a dimension is unread, a polygon when all five are read, full dimension names
 * - Block: rows in BIG_FIVE order as h4, position number never printed as text, pointed-to pole in ink, recommendations
 *   prefixed with their dimension, evidence render prop called once per trait with its evidence, name and open flag
 * - OwnWords: first quote in view when open, "Show N more quotes" with weakens; collapsed "Their own words (n)" with
 *   FACT / all inference when low confidence; a weakening quote forces it into view; weakensFirst keeps stored order
 * - ProfileSections: the heading and Sources cite numbers appear with big5 set, the heading is absent with big5 null
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BIG_FIVE, type BigFive, type BigFiveTrait, Profile, type ProfileEvidence } from "@/domain/claim";
import { BigFiveBlock } from "../big-five";
import { BigFiveChart } from "../big-five-chart";
import { leanLabel, leanSentence, leanText } from "../big-five-lean";
import { evidenceOf } from "../evidence";
import { type Ctx, OwnWords, weakensFirst } from "../evidence-line";
import { ProfileSections } from "../profile-sections";

const ev = (over: Partial<ProfileEvidence> = {}): ProfileEvidence => ({ quote: "I plan every sprint in detail", source_id: "s1", kind: "INFERENCE", supports: true, note: "", strength: "weak", ...over });

const trait = (over: Partial<BigFiveTrait> & Pick<BigFiveTrait, "dimension">): BigFiveTrait => ({ lean: "high", position: 73, confidence: "medium", summary: "", evidence: [ev()], ...over });

// Deliberately out of BIG_FIVE order, with neuroticism missing.
const big5: BigFive = {
  traits: [
    trait({ dimension: "extraversion", lean: "balanced", position: 51, summary: "Writes for a room, not a crowd." }),
    trait({ dimension: "conscientiousness", position: 73 }),
    trait({ dimension: "openness", lean: "low", position: 29, evidence: [ev({ quote: "we ship what works" })] }),
    trait({ dimension: "agreeableness", position: 67, confidence: "low" }),
  ],
  recommendations: [
    { text: "Give them a written agenda.", dimension: "conscientiousness" },
    { text: "Ask for a concrete example.", dimension: null },
  ],
};

type Evidence = (items: ProfileEvidence[], about: string, open: boolean) => ReactNode;
const noEvidence: Evidence = () => null;

describe("leanText", () => {
  it("names the high pole, the low pole, or balanced", () => {
    expect(leanText({ dimension: "conscientiousness", lean: "high" })).toBe("leans Structured");
    expect(leanText({ dimension: "openness", lean: "low" })).toBe("leans Practical");
    expect(leanText({ dimension: "extraversion", lean: "balanced" })).toBe("balanced");
    expect(leanLabel({ dimension: "conscientiousness", lean: "high" })).toBe("Leans Structured");
    expect(leanLabel({ dimension: "extraversion", lean: "balanced" })).toBe("Balanced");
  });
});

describe("leanSentence", () => {
  it("names the leans in BIG_FIVE order, the balanced dimensions and the unread ones", () => {
    expect(leanSentence(big5.traits)).toBe(
      "Leans Practical, Structured and Accommodating; balanced on Extraversion. Not enough of their writing to read stress response.",
    );
    expect(leanSentence([trait({ dimension: "conscientiousness" })])).toBe(
      "Leans Structured. Not enough of their writing to read openness, extraversion, agreeableness and stress response.",
    );
    expect(leanSentence(BIG_FIVE.map((dimension) => trait({ dimension, lean: "balanced" })))).toBe(
      "Balanced on Openness, Conscientiousness, Extraversion, Agreeableness and Stress response.",
    );
    expect(leanSentence([])).toBe("Not enough of their writing for a Big Five read.");
  });
});

describe("BigFiveChart", () => {
  it("is an img labelled with the lean sentence, one dot per present dimension, stubs instead of a polygon when one is unread", () => {
    const out = renderToStaticMarkup(createElement(BigFiveChart, { traits: big5.traits }));
    expect(out).toMatch(/<svg[^>]*role="img"/);
    expect(/aria-label="([^"]+)"/.exec(out)?.[1]).toBe(`Big Five chart: ${leanSentence(big5.traits)}`);
    expect(out.match(/<circle /g)).toHaveLength(4);
    expect(out.match(/pf-big5-dot fill-canvas stroke-inference/g)).toHaveLength(1);
    expect(out.match(/pf-big5-stub/g)).toHaveLength(4);
    expect(out).not.toContain("pf-big5-shape");
    expect(out.match(/<polygon /g)).toHaveLength(2);
    for (const name of ["Openness", "Conscientiousness", "Extraversion", "Agreeableness", "Stress response"]) expect(out).toContain(`>${name}</text>`);
    expect(out).toContain("<figcaption");
    const empty = renderToStaticMarkup(createElement(BigFiveChart, { traits: [] }));
    expect(empty.match(/<circle /g)).toBeNull();
    expect(empty).toContain("Not enough of their writing for a Big Five read.");
  });

  it("draws one polygon when all five dimensions are read", () => {
    const out = renderToStaticMarkup(createElement(BigFiveChart, { traits: BIG_FIVE.map((dimension) => trait({ dimension })) }));
    expect(out.match(/pf-big5-shape/g)).toHaveLength(1);
    expect(out).not.toContain("pf-big5-stub");
  });
});

describe("BigFiveBlock", () => {
  const html = (evidence: Evidence = noEvidence): string => renderToStaticMarkup(createElement(BigFiveBlock, { big5, evidence }));

  it("renders rows in BIG_FIVE order regardless of input order", () => {
    const out = html();
    const at = ["Openness", "Conscientiousness", "Extraversion", "Agreeableness"].map((n) => out.indexOf(`>${n}</h4>`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(out).not.toContain(">Stress response</h4>");
    expect(out).toContain("Writes for a room, not a crowd.");
    expect(out).toContain("· low confidence");
    expect(out).toContain(">Leans Structured<");
    expect(out).toContain('<span class="text-ink">Structured</span>');
    expect(out).toContain('<span class="">Flexible</span>');
    expect(out).toContain("border-inference bg-canvas");
    expect(out.indexOf(leanSentence(big5.traits))).toBeLessThan(out.indexOf("How to work with them"));
    expect(out).not.toMatch(/<h3[^>]*>How to work with them/);
  });

  it("never prints the position number as text", () => {
    const text = html().replace(/<[^>]+>/g, " ");
    for (const t of big5.traits) expect(text).not.toMatch(new RegExp(`\\b${String(t.position)}\\b`));
  });

  it("prefixes recommendations with their dimension", () => {
    const out = html();
    expect(out).toContain("How to work with them");
    expect(out).toContain("Conscientiousness · </span>Give them a written agenda.");
    expect(out).toContain("<li class=\"max-w-prose\">Ask for a concrete example.</li>");
  });

  it("calls the evidence render prop once per trait with that trait's evidence, dimension name and open flag", () => {
    const evidence = vi.fn((items: ProfileEvidence[], about: string, open: boolean): ReactNode => `${about}:${String(items.length)}:${String(open)}`);
    const out = html(evidence);
    expect(evidence).toHaveBeenCalledTimes(big5.traits.length);
    expect(evidence.mock.calls.map(([, about]) => about)).toEqual(["Openness", "Conscientiousness", "Extraversion", "Agreeableness"]);
    const openness = big5.traits.find((t) => t.dimension === "openness");
    expect(evidence).toHaveBeenCalledWith(openness?.evidence, "Openness", true);
    expect(out).toContain("Openness:1:true");
    expect(out).toContain("Agreeableness:1:false");
    expect(BIG_FIVE.filter((d) => d !== "neuroticism")).toHaveLength(4);
  });
});

describe("OwnWords", () => {
  const ctx: Ctx = { evidence: evidenceOf({ sources: [{ id: "s1", url: "https://example.com/blog", fetched_at: "2026-10-09T10:00:00Z" }] }), cite: new Map([["s1", 1]]) };
  const own = (items: ProfileEvidence[], open: boolean): string => renderToStaticMarkup(createElement(OwnWords, { items, ctx, about: "Openness", open }));
  const a = ev({ quote: "first" });
  const b = ev({ quote: "second", kind: "FACT" });
  const w = ev({ quote: "against", direction: "contradicts" });

  it("puts the first quote in view with its link and the rest behind Show N more quotes", () => {
    const out = own([a, b, w], true);
    expect(out.indexOf("against")).toBeLessThan(out.indexOf("<details"));
    expect(out).toContain("Show 2 more quotes<span class=\"sr-only\"> for Openness</span></span>");
    expect(out).toContain(">[1] example.com<");
    expect(out).toContain(">INFERENCE<");
    expect(own([a], true)).not.toContain("<details");
    expect(own([w, w], true)).toMatch(/Show 1 more quote<span class="sr-only"> for Openness<\/span>\u00a0·<\/span><span class="text-conflict">1 weakens</);
  });

  it("collapses low confidence under Their own words with FACT or all inference, unless a quote weakens", () => {
    const out = own([a, b], false);
    expect(out.indexOf("<details")).toBeLessThan(out.indexOf("first"));
    expect(out).toContain("Their own words (2)");
    expect(out).toMatch(/text-ok">1 FACT</);
    expect(own([a], false)).toMatch(/text-inference">all inference</);
    const weak = own([a, w], false);
    expect(weak.indexOf("against")).toBeLessThan(weak.indexOf("<details"));
    expect(weak).not.toContain("Their own words");
    expect(own([], true)).toContain("No supporting quote kept");
    expect(out).not.toMatch(/> ?· /);
  });

  it("weakensFirst moves weakening lines first and keeps stored order", () => {
    expect(weakensFirst([a, w, b, { ...w, quote: "w2" }]).map((e) => e.quote)).toEqual(["against", "w2", "first", "second"]);
  });
});

describe("ProfileSections with big5", () => {
  const profile = (b: BigFive | null): Profile =>
    Profile.parse({
      achievements: [],
      risks: [],
      history: [],
      personality: { disc: null, mbti: null, big5: b, read: "", evidence: [] },
      position_fit: [],
      questions: [],
      degraded: null,
    });
  const evidence = evidenceOf({ sources: [{ id: "s1", url: "https://example.com/blog", fetched_at: "2026-10-09T10:00:00Z" }] });
  const html = (b: BigFive | null): string => renderToStaticMarkup(createElement(ProfileSections, { profile: profile(b), evidence, role: "CTO" }));

  it("renders the heading and its quotes get cite numbers in the Sources list", () => {
    const out = html(big5);
    expect(out).toContain("Big Five lean");
    expect(out).toContain("I plan every sprint in detail");
    expect(out).toContain(">[1] example.com<");
    expect(out).toContain("Sources (1)");
  });

  it("omits the heading with big5 null", () => {
    const out = html(null);
    expect(out).not.toContain("Big Five lean");
    expect(out).not.toContain("Sources (");
  });
});
