/**
 * Boilerplate stripper: drops company-pitch and benefits sections from posting text before extraction.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/posting-strip.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/posting-parse.test.ts
 *
 * Key responsibilities:
 * - `stripBoilerplate`: remove About us, Benefits, Co nabízíme, Equal opportunity sections, heading through the line before the next heading
 *
 * Design constraints:
 * - Pure and idempotent; sections with any other heading are kept verbatim
 * - A heading is a short line (<= 60 chars) without a sentence-ending period that is `#`-prefixed, ends with a colon, or stands alone between blank lines
 */
const DROP = /^(?:about us|about the company|o nás|benefits|benefity|co nabízíme|equal opportunity|eeo)$/i;
const MAX_HEADING = 60;

function isHeading(lines: string[], i: number): boolean {
  const line = (lines[i] ?? "").trim();
  if (!line || line.length > MAX_HEADING || line.endsWith(".")) return false;
  if (line.startsWith("#") || line.endsWith(":")) return true;
  return !(lines[i - 1] ?? "").trim() && !(lines[i + 1] ?? "").trim();
}

function dropsSection(line: string): boolean {
  return DROP.test(line.trim().replace(/^#+\s*/, "").replace(/:$/, "").trim());
}

export function stripBoilerplate(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  let dropping = false;
  lines.forEach((line, i) => {
    if (isHeading(lines, i)) dropping = dropsSection(line);
    if (!dropping) kept.push(line);
  });
  return kept.join("\n");
}
