/**
 * Posting parser: turns a fetched payload (HTML with JSON-LD, ATS JSON, or pasted text) into title, company, location and plain text.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/posting-parse.ts
 * Deps:    src/recipe/seams/posting-plan.ts (PostingMethod)
 *
 * Tested:  src/recipe/__tests__/posting-parse.test.ts
 *
 * Key responsibilities:
 * - `parsePosting`: per-method extraction, never throws, unreadable payload gives `{ text: "" }`
 * - `htmlToText`: tags removed, entities decoded, block tags become newlines
 *
 * Design constraints:
 * - Pure; no I/O. Ashby needs the externalId to pick one job from the board listing
 * - Text only: the caller strips boilerplate and decides the 200-char fetch-failure threshold
 */
import type { PostingMethod } from "@/recipe/seams/posting-plan";

export type ParsedPosting = {
  title?: string;
  company?: string;
  location?: string;
  text: string;
};

type Obj = Record<string, unknown>;
const EMPTY: ParsedPosting = { text: "" };
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e.startsWith("#")) {
      const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Some feeds ship HTML entity-escaped (`&lt;p&gt;`); decode once so the tags can be removed. */
const unescapeHtml = (s: string) => (/&lt;[a-z/]/i.test(s) ? decode(s) : s);

export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|section)>|<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "");
  return decode(withBreaks).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function json(payload: unknown): unknown {
  if (isObj(payload) || Array.isArray(payload)) return payload;
  if (typeof payload !== "string") return undefined;
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

function findJobPosting(node: unknown): Obj | undefined {
  if (Array.isArray(node)) return node.map(findJobPosting).find((p) => p !== undefined);
  if (!isObj(node)) return undefined;
  const type = node["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return node;
  return findJobPosting(node["@graph"]);
}

function parseJsonLd(html: string): ParsedPosting {
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of blocks) {
    const posting = findJobPosting(json(body));
    if (posting === undefined) continue;
    const org = first(posting.hiringOrganization);
    const address = first(posting.jobLocation);
    const locality = isObj(address) && isObj(address.address) ? address.address.addressLocality : undefined;
    const description = str(posting.description);
    return {
      title: str(htmlToText(str(posting.title) ?? "")),
      company: isObj(org) ? str(org.name) : str(org),
      location: str(locality),
      text: description !== undefined ? htmlToText(unescapeHtml(description)) : "",
    };
  }
  return EMPTY;
}

function parseGreenhouse(data: unknown): ParsedPosting {
  if (!isObj(data)) return EMPTY;
  const location = isObj(data.location) ? str(data.location.name) : undefined;
  return { title: str(data.title), company: str(data.company_name), location, text: htmlToText(unescapeHtml(str(data.content) ?? "")) };
}

function parseLever(data: unknown): ParsedPosting {
  if (!isObj(data)) return EMPTY;
  const lists = Array.isArray(data.lists) ? data.lists.filter(isObj) : [];
  const parts = [str(data.descriptionPlain) ?? "", ...lists.map((l) => `${str(l.text) ?? ""}\n${htmlToText(str(l.content) ?? "")}`.trim())];
  return {
    title: str(data.text),
    location: isObj(data.categories) ? str(data.categories.location) : undefined,
    text: parts.filter(Boolean).join("\n\n"),
  };
}

function parseAshby(data: unknown, externalId?: string): ParsedPosting {
  const jobs = isObj(data) && Array.isArray(data.jobs) ? data.jobs.filter(isObj) : [];
  const job = externalId === undefined ? undefined : jobs.find((j) => j.id === externalId);
  if (job === undefined) return EMPTY;
  const plain = str(job.descriptionPlain);
  return { title: str(job.title), location: str(job.location), text: plain ?? htmlToText(str(job.descriptionHtml) ?? "") };
}

export function parsePosting(method: PostingMethod, payload: unknown, externalId?: string): ParsedPosting {
  try {
    if (method === "pasted") return typeof payload === "string" ? { text: payload.trim() } : EMPTY;
    if (method === "jobs-cz" || method === "jsonld") return typeof payload === "string" ? parseJsonLd(payload) : EMPTY;
    const data = json(payload);
    if (method === "greenhouse") return parseGreenhouse(data);
    if (method === "lever") return parseLever(data);
    return parseAshby(data, externalId);
  } catch {
    return EMPTY;
  }
}
