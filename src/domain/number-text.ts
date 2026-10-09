/**
 * Number text: integers with thin-space thousands separators, shared by the profile signals and the code contributions card.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/number-text.ts
 * Deps:    none
 * Tested:  src/app/runs/[id]/__tests__/code-profile-card.test.ts (fmtInt)
 *
 * Key responsibilities:
 * - fmtInt: "1200000" as "1 200 000" with U+2009 between the groups
 *
 * Design constraints:
 * - Pure, no I/O
 */
const THIN_SPACE = "\u2009";

export function fmtInt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
}
