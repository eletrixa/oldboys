/**
 * Czech IČO (company id) normalisation and checksum validation.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/ico.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/ico.test.ts
 *
 * Key responsibilities:
 * - Turn user input ("6947", "270 743 58") into the canonical 8-digit IČO or null
 * - Check the mod-11 control digit
 *
 * Design constraints:
 * - Pure, no I/O; ARES accepts only exactly 8 digits
 */
export function isValidIco(ico: string): boolean {
  if (!/^\d{8}$/.test(ico)) return false;
  const d = Array.from(ico, Number);
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += (8 - i) * (d[i] ?? 0);
  return d[7] === (11 - (sum % 11)) % 10;
}

export function normalizeIco(raw: string): string | null {
  const compact = raw.replace(/\s+/g, "");
  if (!/^\d{1,8}$/.test(compact)) return null;
  const ico = compact.padStart(8, "0");
  return isValidIco(ico) ? ico : null;
}
