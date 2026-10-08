/**
 * Jobs.cz posting parser: reads the visible markers of a `/rpd/<id>` page, which carries no JSON-LD (checked 2026-10-09).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/posting-parse-jobscz.ts
 * Deps:    src/recipe/seams/posting-html.ts
 * Tested:  src/recipe/__tests__/posting-parse.test.ts (fixture jobs-cz.html)
 *
 * Key responsibilities:
 * - Title and company from `<meta property="og:title" content="<title> – <company>">` (en dash separator)
 * - Location from the element `data-test="jd-info-location"`, description from `data-test="jd-body-richtext"`
 *
 * Design constraints:
 * - Pure and never throws; without the description marker the result is `{ text: "" }` so the caller can try JSON-LD
 */
import { decode, htmlToText } from "@/recipe/seams/posting-html";
import type { ParsedPosting } from "@/recipe/seams/posting-parse";

const SEPARATOR = " – ";

/** Inner HTML of the element carrying `marker` (a `data-test` value), balanced on its own tag name. */
function innerOf(html: string, marker: string): string | undefined {
  const open = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*data-test="${marker}"[^>]*>`, "i").exec(html);
  if (!open) return undefined;
  const tag = (open[1] ?? "").toLowerCase();
  const start = open.index + open[0].length;
  let depth = 1;
  for (const m of html.slice(start).matchAll(new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi"))) {
    depth += m[1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(start, start + m.index);
  }
  return undefined;
}

function ogTitle(html: string): { title?: string; company?: string } {
  const meta = /<meta\b[^>]*property=["']og:title["'][^>]*>/i.exec(html)?.[0];
  const content = meta === undefined ? undefined : /content="([^"]*)"/i.exec(meta)?.[1];
  const full = content === undefined ? "" : decode(content).trim();
  if (full === "") return {};
  const cut = full.lastIndexOf(SEPARATOR);
  if (cut < 0) return { title: full };
  return { title: full.slice(0, cut).trim(), company: full.slice(cut + SEPARATOR.length).trim() };
}

export function parseJobsCz(html: string): ParsedPosting {
  const body = innerOf(html, "jd-body-richtext");
  if (body === undefined) return { text: "" };
  const { title, company } = ogTitle(html);
  const place = innerOf(html, "jd-info-location");
  const location = place === undefined ? "" : htmlToText(place).replace(/\s+/g, " ");
  const given = (v: string | undefined): v is string => v !== undefined && v !== "";
  return {
    ...(given(title) ? { title } : {}),
    ...(given(company) ? { company } : {}),
    ...(given(location) ? { location } : {}),
    text: htmlToText(body),
  };
}
