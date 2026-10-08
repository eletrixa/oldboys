/**
 * Deterministic confidence for one brief section: how well the research backs it, never a rating of the person.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/confidence.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/confidence.test.ts
 *
 * Key responsibilities:
 * - sectionConfidence: score 0..1 plus a one-sentence reason naming the drivers
 * - Score = 0.3 + 0.5 × fact share + 0.1 per extra distinct source (max +0.2), then caps:
 *   1 source → 0.6, no confirmed (merged) source → 0.5, no verified fact → 0.4; any contradiction → −0.2
 *
 * Design constraints:
 * - Pure: counts in, number and sentence out; computed in the synthesize seam, never by the LLM
 * - Rounded to 2 decimals, clamped to 0..0.95 (a public-web brief is never certain)
 */

export type SectionCounts = {
  /** All claims in the section (FACT, INFERENCE, STATEMENT). */
  claims: number;
  /** FACT claims with at least one confirmed supporting source (verify already checked the quote). */
  facts: number;
  /** INFERENCE claims. */
  inferences: number;
  /** Distinct supporting sources. */
  sources: number;
  /** Distinct supporting sources whose identity is "merged". */
  confirmed_sources: number;
  /** Claims that name at least one contradicting source. */
  contradictions: number;
};

export type SectionConfidence = { confidence: number; confidence_reason: string };

const SINGLE_SOURCE_CAP = 0.6;
const UNCONFIRMED_CAP = 0.5;
const NO_FACT_CAP = 0.4;
const CONTRADICTION_PENALTY = 0.2;
/** A public-web brief is never certain. */
const MAX_SCORE = 0.95;

const count = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

function claimsPart(c: SectionCounts): string {
  if (c.claims === 0) return "no claims";
  const other = c.claims - c.facts - c.inferences;
  const parts = [c.facts > 0 ? count(c.facts, "fact") : null, c.inferences > 0 ? count(c.inferences, "inference") : null, other > 0 ? `${String(other)} unverified` : null];
  return parts.filter((p): p is string => p !== null).join(", ");
}

function sourcesPart(c: SectionCounts): string {
  if (c.sources === 0) return "no source";
  if (c.confirmed_sources >= c.sources) return count(c.sources, "confirmed source");
  if (c.confirmed_sources === 0) return `${count(c.sources, "source")}, none confirmed`;
  return `${count(c.sources, "source")}, ${String(c.confirmed_sources)} confirmed`;
}

/** "2 facts from 2 confirmed sources, no contradictions". */
function reason(c: SectionCounts): string {
  const contradictions = c.contradictions === 0 ? "no contradictions" : count(c.contradictions, "contradiction");
  const sentence = `${claimsPart(c)} ${c.claims === 0 ? "and" : "from"} ${sourcesPart(c)}, ${contradictions}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function sectionConfidence(c: SectionCounts): SectionConfidence {
  const factShare = c.claims > 0 ? c.facts / c.claims : 0;
  let score = 0.3 + 0.5 * factShare + 0.1 * Math.min(Math.max(c.sources - 1, 0), 2);
  if (c.sources <= 1) score = Math.min(score, SINGLE_SOURCE_CAP);
  if (c.confirmed_sources === 0) score = Math.min(score, UNCONFIRMED_CAP);
  if (c.facts === 0) score = Math.min(score, NO_FACT_CAP);
  if (c.contradictions > 0) score -= CONTRADICTION_PENALTY;
  const confidence = Math.round(Math.min(MAX_SCORE, Math.max(0, score)) * 100) / 100;
  return { confidence, confidence_reason: reason(c) };
}
