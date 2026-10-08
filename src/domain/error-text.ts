/**
 * One way to turn an unknown thrown value into a short log or note string.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/error-text.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/digest.test.ts (same small suite)
 *
 * Key responsibilities:
 * - errorText(err, max): Error message or String(err), cut to max characters (default 300)
 *
 * Design constraints:
 * - Never throws; never includes a stack
 */

export function errorText(err: unknown, max = 300): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, max);
}
