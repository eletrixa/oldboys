/**
 * GDPR Art. 9 denylist shared by every gate that must never ask about, record or summarise special-category data.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/art9.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/art9.test.ts
 *
 * Key responsibilities:
 * - One pattern for the call brief, the call-transcript extractor and the synthesize seam
 *
 * Design constraints:
 * - Stems match at the start of a word (suffixes allowed), case-insensitive, Unicode-aware (`\b` is ASCII-only)
 * - Over-matching is the safe direction, but professions and employers stay askable: `odborník` (expert),
 *   `nemocnice` (hospital), `zdravotník` (paramedic), "medical device company" and "customer orientation" pass
 */

export const ART9_PATTERN =
  /(?<![\p{L}])(health|medical (condition|history|record|leave|diagnos)|illness|disease|diagnos|pregnan|disab|religio|church|muslim|christian|jewish|politic|party member|vote|ethnic|race|racial|nationality|romani|sexual|sexuality|gay|lesbian|transgender|trade union|union member|biometric|genetic|zdravotní (stav|problém|potíž|omezen)|nemoc(?!nic)|nábožen|politick|etnick|sexuál|odborov|odborář|odbory(?![\p{L}])|odborů(?![\p{L}]))\p{L}*/iu;

export function containsArt9Topic(text: string): boolean {
  return ART9_PATTERN.test(text);
}
