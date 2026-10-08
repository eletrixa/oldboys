/**
 * Near-duplicate text test: folded equality or token Jaccard similarity, used by verify to merge duplicate claims.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/similar.ts
 * Deps:    src/domain/corroborate (fold), src/domain/quote (normalizeText)
 * Tested:  src/domain/__tests__/similar.test.ts
 *
 * Key responsibilities:
 * - tokens(text): folded (lowercase, no diacritics), punctuation-free word set
 * - jaccard(a, b): |A ∩ B| / |A ∪ B| over those sets
 * - nearDuplicate(a, b): folded texts equal, or jaccard >= NEAR_DUPLICATE (0.8)
 *
 * Design constraints:
 * - Pure, no I/O; word order is ignored, so it is a duplicate screen, not a paraphrase detector
 */
import { fold } from "@/domain/corroborate";
import { normalizeText } from "@/domain/quote";

export const NEAR_DUPLICATE = 0.8;

const folded = (text: string): string => normalizeText(fold(text));

export function tokens(text: string): Set<string> {
  return new Set(folded(text).split(" ").filter(Boolean));
}

export function jaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  const union = new Set([...ta, ...tb]).size;
  if (union === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / union;
}

export function nearDuplicate(a: string, b: string): boolean {
  return folded(a) === folded(b) || jaccard(a, b) >= NEAR_DUPLICATE;
}
