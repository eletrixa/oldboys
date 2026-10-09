/**
 * Posting parser: turns a fetched payload (HTML with JSON-LD, ATS JSON, or pasted text) into title, company, location and plain text.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/posting-parse.ts
 * Deps:    src/recipe/seams/{posting-plan,posting-html,posting-parse-jobscz}.ts
 * Tested:  src/recipe/__tests__/posting-parse.test.ts
 *
 * Key responsibilities:
 * - `parsePosting`: per-method extraction, never throws, unreadable payload gives `{ text: "" }`
 * - Jobs.cz pages go to `parseJobsCz` first (no JSON-LD there), JSON-LD is the fallback and the `jsonld` and `startupjobs` methods
 *
 * Design constraints:
 * - Pure; no I/O. Ashby needs the externalId to pick one job from the board listing
 * - Text only: the caller strips boilerplate and decides the 200-char fetch-failure threshold
 */
import { decode, htmlToText } from "@/recipe/seams/posting-html";
import { parseJobsCz } from "@/recipe/seams/posting-parse-jobscz";
import type { PostingMethod } from "@/recipe/seams/posting-plan";

export type ParsedPosting = {
  title?: string;
  company?: string;
  location?: string;
  text: string;
};

type Obj = Record<string, unknown>;
const EMPTY: ParsedPosting = { text: "" };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

/** Some feeds ship HTML entity-escaped (`&lt;p&gt;`); decode once so the tags can be removed. */
const unescapeHtml = (s: string) => (/&lt;[a-z/]/i.test(s) ? decode(s) : s);

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
    if (method === "pasted" || method === "manual") return typeof payload === "string" ? { text: payload.trim() } : EMPTY;
    if (method === "jobs-cz" || method === "jsonld" || method === "startupjobs") {
      if (typeof payload !== "string") return EMPTY;
      const page = method === "jobs-cz" ? parseJobsCz(payload) : EMPTY;
      return page.text === "" ? parseJsonLd(payload) : page;
    }
    const data = json(payload);
    if (method === "greenhouse") return parseGreenhouse(data);
    if (method === "lever") return parseLever(data);
    return parseAshby(data, externalId);
  } catch {
    return EMPTY;
  }
}
