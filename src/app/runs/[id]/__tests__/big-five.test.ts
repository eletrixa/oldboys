/**
 * Tests for the Big Five block of the working-style section: lean text, pentagon chart, rows, recommendations, evidence prop.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/big-five.test.ts
 * Deps:    vitest, react, react-dom/server (static markup, no DOM)
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - leanText: pole word per lean, "balanced" for the middle
 * - Chart: role img, aria-label names every present dimension's lean, one dot per present dimension, none for a missing one
 * - Block: rows in BIG_FIVE order, position number never printed as text, recommendations prefixed with their dimension,
 *   evidence render prop called once per trait with that trait's evidence and dimension name
 * - ProfileSections: the heading and Sources cite numbers appear with big5 set, the heading is absent with big5 null
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BIG_FIVE, type BigFive, type BigFiveTrait, Profile, type ProfileEvidence } from "@/domain/claim";
import { BigFiveBlock, BigFiveChart, leanText } from "../big-five";
import { evidenceOf } from "../evidence";
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

type Evidence = (items: ProfileEvidence[], about: string) => ReactNode;
const noEvidence: Evidence = () => null;

describe("leanText", () => {
  it("names the high pole, the low pole, or balanced", () => {
    expect(leanText({ dimension: "conscientiousness", lean: "high" })).toBe("leans Structured");
    expect(leanText({ dimension: "openness", lean: "low" })).toBe("leans Practical");
    expect(leanText({ dimension: "extraversion", lean: "balanced" })).toBe("balanced");
  });
});

describe("BigFiveChart", () => {
  it("is an img with an aria-label naming every present dimension's lean and one dot per present dimension", () => {
    const out = renderToStaticMarkup(createElement(BigFiveChart, { traits: big5.traits }));
    expect(out).toMatch(/<svg[^>]*role="img"/);
    const label = /aria-label="([^"]+)"/.exec(out)?.[1] ?? "";
    expect(label).toContain("Openness leans Practical");
    expect(label).toContain("Conscientiousness leans Structured");
    expect(label).toContain("Extraversion balanced");
    expect(label).toContain("Agreeableness leans Accommodating");
    expect(label).not.toContain("Stress response");
    expect(out.match(/<circle /g)).toHaveLength(4);
    expect(renderToStaticMarkup(createElement(BigFiveChart, { traits: [] })).match(/<circle /g)).toBeNull();
  });
});

describe("BigFiveBlock", () => {
  const html = (evidence: Evidence = noEvidence): string => renderToStaticMarkup(createElement(BigFiveBlock, { big5, evidence }));

  it("renders rows in BIG_FIVE order regardless of input order", () => {
    const out = html();
    const at = ["Openness", "Conscientiousness", "Extraversion", "Agreeableness"].map((n) => out.indexOf(`>${n}</h3>`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(out).not.toContain(">Stress response</h3>");
    expect(out).toContain("Writes for a room, not a crowd.");
    expect(out).toContain("· low confidence");
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

  it("calls the evidence render prop once per trait with that trait's evidence and dimension name", () => {
    const evidence = vi.fn((items: ProfileEvidence[], about: string): ReactNode => `${about}:${String(items.length)}`);
    const out = html(evidence);
    expect(evidence).toHaveBeenCalledTimes(big5.traits.length);
    expect(evidence.mock.calls.map(([, about]) => about)).toEqual(["Openness", "Conscientiousness", "Extraversion", "Agreeableness"]);
    const openness = big5.traits.find((t) => t.dimension === "openness");
    expect(evidence).toHaveBeenCalledWith(openness?.evidence, "Openness");
    expect(out).toContain("Openness:1");
    expect(BIG_FIVE.filter((d) => d !== "neuroticism")).toHaveLength(4);
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
