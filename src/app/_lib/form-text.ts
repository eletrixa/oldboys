/**
 * Read one text field from a FormData, "" when absent or a file.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_lib/form-text.ts
 * Deps:    none (browser and Worker safe, no "use client")
 * Tested:  n/a (one-liner; exercised by the apply and tag form tests)
 *
 * Key responsibilities:
 * - formText(data, key): the string value of `key`, never a File, never null
 *
 * Design constraints:
 * - Shared by the client forms and the multipart route handlers; keep it dependency-free
 */

export function formText(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}
