/**
 * Count with its noun: "1 brief", "3 briefs", "2 criteria".
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_lib/plural.ts
 * Deps:    none (browser and Worker safe, no "use client")
 * Tested:  src/app/_lib/__tests__/plural.test.ts
 *
 * Key responsibilities:
 * - plural(n, one, many?): `${n} ${one}` for exactly 1, otherwise `${n} ${many}` (default: one + "s")
 *
 * Design constraints:
 * - English only; Czech counts live in the brief dictionary
 */

export const plural = (n: number, one: string, many = `${one}s`): string => `${String(n)} ${n === 1 ? one : many}`;
