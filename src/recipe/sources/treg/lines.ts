/**
 * Role and employment-history lines shared by the treg people collectors.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/treg/lines.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/treg-search.test.ts
 *
 * Key responsibilities:
 * - `roleOf`: `<title> @ <company>`, or whichever part exists, "" when neither
 * - `historyLine`: the role, then ` (<from>–<to or "now">)` only when a start date exists
 *
 * Design constraints:
 * - Pure string helpers; callers pass already trimmed strings (`txt`)
 */

export function roleOf(title: string, company: string): string {
  return [title, company].filter((s) => s !== "").join(" @ ");
}

export function historyLine(title: string, company: string, from: string, to: string): string {
  const role = roleOf(title, company);
  return from === "" ? role : `${role} (${from}–${to === "" ? "now" : to})`;
}
