/**
 * Quote-in-excerpt check shared by every honesty gate: web-source verify and call-transcript ingest.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/quote.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/call-ingest.test.ts (via quoteInExcerpt), src/recipe/__tests__/verify.test.ts
 *
 * Key responsibilities:
 * - One normalisation (lowercase, Unicode letters/digits only, collapsed whitespace) so FACT and
 *   STATEMENT can never disagree on what "the quote is in the source" means
 *
 * Design constraints:
 * - Pure; diacritics are kept (Czech transcripts), punctuation is dropped
 */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the normalised quote is non-empty and contained in the normalised excerpt. */
export function quoteInExcerpt(quote: string, excerpt: string): boolean {
  return quoteInNormalized(quote, normalizeText(excerpt));
}

/** Same check against an excerpt normalised once by the caller (loops over many quotes). */
export function quoteInNormalized(quote: string, normalizedExcerpt: string): boolean {
  const q = normalizeText(quote);
  return q.length > 0 && normalizedExcerpt.includes(q);
}
