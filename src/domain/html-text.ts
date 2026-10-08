/**
 * HTML to plain text for intake connectors: tags stripped, block breaks kept, entities decoded, whitespace collapsed.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/html-text.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/html-text.test.ts
 *
 * Key responsibilities:
 * - `htmlToText`: readable text of an HTML mail body (email connector) or an HTML form answer (StartupJobs)
 *
 * Design constraints:
 * - Pure, no dependency; good enough for cover letters, not a general HTML renderer
 * - Entities are decoded in one pass so "&amp;lt;" stays "&lt;"
 * - Every pattern is linear in the input (mail bodies reach 10 MiB): no lazy scan that can restart at each "<"
 */

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntity(match: string, body: string): string {
  if (body.startsWith("#")) {
    const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  }
  return NAMED[body.toLowerCase()] ?? match;
}

export function htmlToText(html: string): string {
  return html
    // An unclosed comment or element runs to the end (as in a browser), so each pattern scans the input once.
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<(head|script|style)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6]|table|ul|ol|blockquote)\s*>/gi, "\n")
    .replace(/<[^<>]*>/g, " ")
    .replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,6});/gi, decodeEntity)
    .split("\n")
    .map((line) => line.replace(/[ \t\r\f\v ]+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
}
