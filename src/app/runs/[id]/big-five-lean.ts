/**
 * Plain-language text for the Big Five read: pole words per dimension, the lean of one row, and the one-sentence summary.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/big-five-lean.ts
 * Deps:    src/domain/claim (BIG_FIVE, BigFive, BigFiveDimension)
 * Tested:  src/app/runs/[id]/__tests__/big-five.test.ts
 *
 * Key responsibilities:
 * - DIMENSION: display name and the two pole words per dimension
 * - leanText / leanLabel: "leans Structured" / "Leans Structured", "balanced" / "Balanced"
 * - leanSentence: "Leans A, B and C; balanced on D. Not enough of their writing to read E." in BIG_FIVE order
 *
 * Design constraints:
 * - Deterministic text only: the sentence is never a model output, so it can be tested and reused verbatim as the chart aria-label
 * - No number is ever part of the text (brief: no personality scores)
 */
import { BIG_FIVE, type BigFive, type BigFiveDimension } from "@/domain/claim";

type Trait = BigFive["traits"][number];

export const DIMENSION: Record<BigFiveDimension, { name: string; low: string; high: string }> = {
  openness: { name: "Openness", low: "Practical", high: "Exploratory" },
  conscientiousness: { name: "Conscientiousness", low: "Flexible", high: "Structured" },
  extraversion: { name: "Extraversion", low: "Reserved", high: "Outgoing" },
  agreeableness: { name: "Agreeableness", low: "Challenging", high: "Accommodating" },
  neuroticism: { name: "Stress response", low: "Steady", high: "Reactive" },
};

const LEAN: Record<Trait["lean"], string> = { low: "leans", balanced: "balanced", high: "leans" };

/** The lean as a sentence fragment: "leans Structured", "balanced". */
export function leanText(t: Pick<Trait, "dimension" | "lean">): string {
  const d = DIMENSION[t.dimension];
  return t.lean === "balanced" ? LEAN.balanced : `${LEAN[t.lean]} ${t.lean === "high" ? d.high : d.low}`;
}

/** The lean as a label: "Leans Structured", "Balanced". */
export function leanLabel(t: Pick<Trait, "dimension" | "lean">): string {
  const s = leanText(t);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "A" | "A and B" | "A, B and C". */
const join = (xs: string[]): string => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1) ?? ""}`);

/** One-sentence read of the whole block, rows in BIG_FIVE order; unread dimensions are named, never shown as balanced. */
export function leanSentence(traits: BigFive["traits"]): string {
  if (traits.length === 0) return "Not enough of their writing for a Big Five read.";
  const rows = BIG_FIVE.flatMap((d) => traits.filter((t) => t.dimension === d));
  const leaning = rows.flatMap((t) => (t.lean === "balanced" ? [] : [t.lean === "high" ? DIMENSION[t.dimension].high : DIMENSION[t.dimension].low]));
  const balanced = rows.flatMap((t) => (t.lean === "balanced" ? [DIMENSION[t.dimension].name] : []));
  const missing = BIG_FIVE.filter((d) => !traits.some((t) => t.dimension === d)).map((d) => DIMENSION[d].name.toLowerCase());
  const first =
    leaning.length > 0 ? `Leans ${join(leaning)}${balanced.length > 0 ? `; balanced on ${join(balanced)}` : ""}.` : `Balanced on ${join(balanced)}.`;
  return missing.length > 0 ? `${first} Not enough of their writing to read ${join(missing)}.` : first;
}
