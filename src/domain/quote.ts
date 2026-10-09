/**
 * Quote-in-excerpt check shared by every honesty gate (web-source verify, call-transcript ingest) and the report's
 * "saved copy" around a claim's quote.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/quote.ts
 * Deps:    src/domain/art9 (containsArt9Topic)
 * Tested:  src/domain/__tests__/quote.test.ts, src/domain/__tests__/call-ingest.test.ts (via quoteInExcerpt), src/recipe/__tests__/verify.test.ts
 *
 * Key responsibilities:
 * - One normalisation (lowercase, Unicode letters/digits only, collapsed whitespace) so FACT and
 *   STATEMENT can never disagree on what "the quote is in the source" means
 * - quoteContext: where that same normalised match sits in the raw excerpt, as original characters before / match /
 *   after (clipped at word boundaries with "…"), for the report's evidence panel (idea #5)
 * - quoteContexts: one context per (claim with a quote, source it cites); Art. 9 topics around the quote drop the
 *   surrounding text and keep the quote only
 *
 * Design constraints:
 * - Pure; diacritics are kept (Czech transcripts), punctuation is dropped
 * - Never a context for a source the claim does not cite; whole excerpts never leave the server
 */
import { containsArt9Topic } from "./art9";

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

export type QuoteContext = { before: string; match: string; after: string };

/** Normalised text plus, per normalised character, the raw [start, end) it came from (punctuation is dropped). */
function normalizeWithMap(raw: string): { text: string; start: number[]; end: number[] } {
  let text = "";
  const start: number[] = [];
  const end: number[] = [];
  let space = false;
  let i = 0;
  for (const ch of raw) {
    const next = i + ch.length;
    if (/\s/u.test(ch)) {
      space = text.length > 0;
    } else {
      const kept = ch.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      if (kept !== "") {
        if (space) {
          text += " ";
          start.push(i);
          end.push(i);
          space = false;
        }
        for (const _unit of kept.split("")) {
          start.push(i);
          end.push(next);
        }
        text += kept;
      }
    }
    i = next;
  }
  return { text, start, end };
}

/**
 * The quote inside the raw excerpt (normalizeText rules) as original characters: up to `radius` characters before and
 * after the match, cut at a word boundary with "…" when clipped. Null when the quote is empty or not in the excerpt.
 */
export function quoteContext(quote: string, excerpt: string, radius = 160): QuoteContext | null {
  const q = normalizeWithMap(quote).text;
  if (q === "") return null;
  const map = normalizeWithMap(excerpt);
  const at = map.text.indexOf(q);
  if (at === -1) return null;
  const from = map.start[at] ?? 0;
  const to = map.end[at + q.length - 1] ?? excerpt.length;

  const lo = Math.max(0, from - radius);
  let before = excerpt.slice(lo, from);
  if (lo > 0) before = `…${(/\s/u.test(excerpt.charAt(lo - 1)) ? before : before.replace(/^\S*\s+/u, "")).trimStart()}`;

  const hi = Math.min(excerpt.length, to + radius);
  let after = excerpt.slice(to, hi);
  if (hi < excerpt.length) after = `${(/\s/u.test(excerpt.charAt(hi)) ? after : after.replace(/\s+\S*$/u, "")).trimEnd()}…`;

  return { before, match: excerpt.slice(from, to), after };
}

export type ClaimQuoteContext = QuoteContext & { claim_id: string; source_id: string };

/**
 * One context per claim with a quote and per source it cites (sources the claim does not cite never get one).
 * When the text around the quote touches a GDPR Art. 9 topic, before/after are emptied and only the quote is kept.
 */
export function quoteContexts(
  claims: readonly { id: string; quote: string | null; supports: readonly string[] }[],
  excerptOf: ReadonlyMap<string, string>,
  radius = 160,
): ClaimQuoteContext[] {
  return claims.flatMap((c) => {
    if (c.quote === null || c.quote.trim() === "") return [];
    const quote = c.quote;
    return [...new Set(c.supports)].flatMap((sid) => {
      const excerpt = excerptOf.get(sid);
      const ctx = excerpt === undefined ? null : quoteContext(quote, excerpt, radius);
      if (ctx === null) return [];
      const safe = containsArt9Topic(ctx.before + ctx.match + ctx.after) ? { before: "", match: ctx.match, after: "" } : ctx;
      return [{ claim_id: c.id, source_id: sid, ...safe }];
    });
  });
}
