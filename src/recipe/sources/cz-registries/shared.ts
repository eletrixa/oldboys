/**
 * Shared pieces of the Czech registry collectors: the person's name split for forms, HTML block and label/value helpers.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/cz-registries/shared.ts
 * Deps:    src/domain/html-text (htmlToText), src/domain/cz-registry (types)
 * Tested:  src/recipe/__tests__/cz-registries.test.ts
 *
 * Key responsibilities:
 * - `personName(subject)`: academic titles stripped, first token = given name, last token = surname (Czech forms want both)
 * - `blocks(html, marker)`: split a result page into per-record HTML chunks starting at each marker
 * - `cells(row)`: one line per table cell; `labelled(text)`: "Label:" lines followed by their value lines -> map (justice.cz result tables)
 * - `RegistrySource`: one registry's request builder, human URL and parser; `Answer` = what a parser returns
 *
 * Design constraints:
 * - Pure; parsers never throw on an unexpected page (they return no hits and a note)
 */
import type { RegistryHit, RegistryId } from "@/domain/cz-registry";
import { htmlToText } from "@/domain/html-text";
import type { CollectorRequest } from "@/recipe/sources/types";

export type PersonName = { full: string; first: string; last: string };

const TITLES = /\b(ing|mgr|bc|judr|mudr|mddr|mvdr|phdr|rndr|phd|ph\.d|csc|drsc|dr|prof|doc|dis|mba|llm|ll\.m|arch|bca|mga|thdr|paeddr|pharmdr)\.?,?/gi;

export function personName(subject: string): PersonName | null {
  const tokens = subject
    .replace(TITLES, " ")
    .replace(/[,;()]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length < 2) return null;
  const first = tokens[0] ?? "";
  const last = tokens[tokens.length - 1] ?? "";
  return { full: tokens.join(" "), first, last };
}

/** HTML chunks, one per occurrence of `marker` (the chunk runs to the next marker). The text before the first marker is dropped. */
export function blocks(html: string, marker: string): string[] {
  const parts = html.split(marker);
  return parts.slice(1).map((p) => marker + p);
}

/** "Label:" line -> the following non-label lines joined by " "; later duplicates win. */
export function labelled(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let key: string | null = null;
  for (const line of text.split("\n")) {
    if (/^[^:]{2,40}:$/.test(line)) {
      key = line.slice(0, -1).trim();
      out.set(key, "");
      continue;
    }
    if (key !== null) out.set(key, `${out.get(key) ?? ""} ${line}`.trim());
  }
  return out;
}

export const text = htmlToText;

/** Table rows as lines: one line per cell (htmlToText breaks only on block tags, not on `</td>`). */
export function cells(rowHtml: string): string[] {
  return text(rowHtml.replace(/<\/t[dh]\s*>/gi, "\n")).split("\n");
}

/** Only the lines a reader needs; registries print the same name in capitals. */
export function tidyName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (m) => m.toUpperCase());
}

/** The hit names the same person as the query: both tokens present as whole words, diacritics- and case-insensitive. */
export function namesMatch(hitName: string, name: PersonName): boolean {
  const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const words = new Set(fold(hitName).split(/[^a-z0-9]+/));
  return words.has(fold(name.first)) && words.has(fold(name.last));
}

export type Answer = { hits: RegistryHit[]; total: number | null; note: string | null };

export type RegistrySource = {
  id: RegistryId;
  /** The one request that answers the check for this person. */
  request: (name: PersonName) => CollectorRequest;
  /** A URL a reader can open to repeat the search (a POST form gets its fields in the fragment). */
  url: (name: PersonName) => string;
  parse: (payload: unknown, name: PersonName) => Answer;
};

export const HTML = { accept: "text/html" };
export const FORM = { accept: "text/html", "content-type": "application/x-www-form-urlencoded" };

export function form(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

export const unavailable = (note: string): Answer => ({ hits: [], total: null, note });
