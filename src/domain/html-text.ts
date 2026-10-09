/**
 * HTML to plain text for intake connectors and read web pages, plus the page passages that mention a person.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/html-text.ts
 * Deps:    none (fold / escape from src/domain/corroborate)
 * Tested:  src/domain/__tests__/html-text.test.ts
 *
 * Key responsibilities:
 * - `htmlToText`: readable text of an HTML mail body (email connector) or an HTML form answer (StartupJobs)
 * - `htmlPageText`: a web page as `{ title, text }` (rest/read-pages): also drops noscript/svg/nav/header/footer/aside,
 *   keeps at most one blank line; title from <title>, else og:title
 * - `mentionWindows`: diacritics- and case-insensitive whole-word search for any needle; ±window chars per match
 *   snapped to sentence or line boundaries, overlapping windows merged, at most `max`, in document order
 * - `pageExcerpt`: title line + windows joined by "\n…\n"; no match = title + the lead text; clipped to `max`
 *
 * Design constraints:
 * - Pure, no dependency; good enough for cover letters, not a general HTML renderer
 * - Entities are decoded in one pass so "&amp;lt;" stays "&lt;"
 * - Every pattern is linear in the input (mail bodies reach 10 MiB): no lazy scan that can restart at each "<"
 * - Window text is sliced from the original text, never from the folded copy, so a quote taken from an excerpt stays verbatim
 */
import { escape, fold } from "@/domain/corroborate";

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

const ENTITY = /&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,6});/gi;
const inline = (s: string): string => s.replace(/<[^<>]*>/g, " ").replace(ENTITY, decodeEntity).replace(/\s+/g, " ").trim();
const LEAD_CHARS = 1500;

function pageTitle(html: string): string {
  const t = /<title\b[^<>]*>([\s\S]*?)(?:<\/title\s*>|$)/i.exec(html)?.[1];
  if (t !== undefined && inline(t) !== "") return inline(t);
  for (const tag of html.match(/<meta\b[^<>]*>/gi) ?? []) {
    if (!/(?:property|name)\s*=\s*["']og:title["']/i.test(tag)) continue;
    const content = /content\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    return inline(content?.[1] ?? content?.[2] ?? "");
  }
  return "";
}

/** A web page as title + body text; page chrome (nav, header, footer, aside) is dropped, at most one blank line is kept. */
export function htmlPageText(html: string): { title: string; text: string } {
  const text = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<(head|script|style|noscript|svg|nav|header|footer|aside|template)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, "\n")
    .replace(/<\/?(?:p|div|br|li|ul|ol|h[1-6]|tr|table|section|article|main|blockquote|dd|dt|hr)\b[^<>]*>/gi, "\n")
    .replace(/<[^<>]*>/g, " ")
    .replace(ENTITY, decodeEntity)
    .split(/\r\n?|\n/)
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title: pageTitle(html), text };
}

/** The folded text plus, for every folded UTF-16 unit, the index of the original character it came from (and a text.length sentinel). */
function foldWithMap(text: string): { folded: string; at: number[] } {
  let folded = "";
  const at: number[] = [];
  let i = 0;
  for (const ch of text) {
    const f = fold(ch);
    folded += f;
    at.push(...new Array<number>(f.length).fill(i));
    i += ch.length;
  }
  at.push(text.length);
  return { folded, at };
}

const isBoundary = (text: string, k: number): boolean => text[k] === "\n" || (/[.!?]/.test(text[k] ?? "") && /\s/.test(text[k + 1] ?? " "));

/** Start of the earliest sentence or line beginning in [lo, start]; lo itself when there is none. */
function snapStart(text: string, lo: number, start: number): number {
  if (lo === 0) return 0;
  for (let k = lo; k < start; k++) {
    if (!isBoundary(text, k)) continue;
    let s = k + 1;
    while (s < start && /\s/.test(text[s] ?? "")) s++;
    return s;
  }
  return lo;
}

/** End of the latest sentence or line finishing in [end, hi]; hi itself when there is none. */
function snapEnd(text: string, end: number, hi: number): number {
  if (hi === text.length) return hi;
  for (let k = hi - 1; k >= end; k--) if (isBoundary(text, k)) return text[k] === "\n" ? k : k + 1;
  return hi;
}

/** Verbatim passages of `text` around whole-word, diacritics- and case-insensitive mentions of any needle. */
export function mentionWindows(text: string, needles: readonly string[], opts: { window?: number; max?: number } = {}): string[] {
  const width = opts.window ?? 500;
  const max = opts.max ?? 4;
  const folded = [...new Set(needles.map((n) => fold(n).trim()).filter((n) => n !== ""))].sort((a, b) => b.length - a.length);
  if (folded.length === 0 || max <= 0) return [];
  const alt = folded.map((n) => n.split(/\s+/).map(escape).join("\\s+")).join("|");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}\\p{N}])`, "gu");
  const map = foldWithMap(text);
  const spans: { lo: number; hi: number }[] = [];
  for (const m of map.folded.matchAll(re)) {
    const start = map.at[m.index] ?? 0;
    const end = map.at[m.index + m[0].length] ?? text.length;
    const lo = snapStart(text, Math.max(0, start - width), start);
    const hi = snapEnd(text, end, Math.min(text.length, end + width));
    const last = spans.at(-1);
    if (last !== undefined && lo <= last.hi) last.hi = Math.max(last.hi, hi);
    else spans.push({ lo, hi });
  }
  return spans
    .slice(0, max)
    .map((s) => text.slice(s.lo, s.hi).trim())
    .filter((w) => w !== "");
}

/** Title line + mention windows joined by "\n…\n" (no mention: title + the lead text), clipped to `max` chars. */
export function pageExcerpt(page: { title: string; text: string }, needles: readonly string[], max: number): string {
  const windows = mentionWindows(page.text, needles);
  const body = windows.length > 0 ? windows.join("\n…\n") : page.text.slice(0, LEAD_CHARS).trim();
  const out = [page.title, body].filter((p) => p !== "").join("\n");
  return out.length <= max ? out : `${out.slice(0, max - 1)}…`;
}
