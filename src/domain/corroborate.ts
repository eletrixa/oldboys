/**
 * Deterministic identity corroboration: full-name match, distinctive employer tokens, place match, and the
 * professional-only filter for lineup reasons and snippets.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/corroborate.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/corroborate.test.ts
 *
 * Key responsibilities:
 * - `corroborationReason`: a page names the subject in full (either order, diacritics-insensitive) AND carries a
 *   distinctive token of a confirmed employer -> "name and employer match (<Org>)"; null otherwise
 * - `orgTokens`: organisation names -> folded whole-word tokens (4+ chars, no generic words, no name parts)
 * - `placeOf` / `mentionsPlace`: the anchor's place ("Prague" from "Prague, Czechia") as a whole word
 * - `professionalReasons` / `professionalSnippet`: drop personal-life details (check-ins, profile pictures,
 *   family words, hobbies) from what the lineup shows
 *
 * Design constraints:
 * - Pure, no I/O; never merges on a name alone (plans/001 case studies §B)
 */

/** Lowercase, diacritics stripped: "Buryán" -> "buryan". */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word (letters/digits) test on already folded text. */
function hasWord(hay: string, word: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`, "u").test(hay);
}

/** Words in organisation names that say nothing about which organisation it is. */
const ORG_STOP = new Set([
  "group", "company", "companies", "limited", "corp", "corporation", "holding", "holdings", "international", "global",
  "services", "service", "solutions", "gmbh", "consulting", "partners", "digital", "marketing", "media", "technologies",
  "technology", "systems", "software", "agency", "nasdaq", "nyse", "self", "employed", "freelance", "freelancer",
  "stealth", "startup", "czech", "czechia", "republic", "europe", "university", "school", "team", "labs", "ventures",
  "capital", "management", "industries", "enterprise", "enterprises", "present", "with", "from", "growth", "business",
  "native", "brand", "sales", "product", "data", "head", "chief", "officer", "director", "manager", "turnaround",
]);

/** Organisation names hinted in a headline: "ex-Meta", "CMO @ Groupon", "Engineer at Kiwi.com". */
export function headlineOrgs(headline: string): string[] {
  return [...headline.matchAll(/(?:\bex-|@\s*|\bat\s+)(\p{Lu}[\p{L}\p{N}&.'-]*(?:\s+\p{Lu}[\p{L}\p{N}&.'-]*)*)/gu)].map((m) => m[1] ?? "");
}

export type OrgToken = { token: string; label: string };

/**
 * Distinctive tokens of the subject's organisations: folded words of 4+ chars, minus ORG_STOP and the subject's
 * own name parts ("Buryan Consulting" never corroborates "Josef Buryan"). Deduped by token.
 */
export function orgTokens(orgs: readonly string[], subject: string): OrgToken[] {
  const nameParts = new Set(fold(subject).split(/[^\p{L}]+/u));
  const byToken = new Map<string, string>();
  for (const word of orgs.flatMap((o) => o.split(/[^\p{L}\p{N}]+/u))) {
    const token = fold(word);
    if (token.length < 4 || ORG_STOP.has(token) || nameParts.has(token) || byToken.has(token)) continue;
    byToken.set(token, word);
  }
  return [...byToken].map(([token, label]) => ({ token, label }));
}

/** Full name in either order ("Josef Buryan", "Buryan, Josef", "josef-buryan"), case- and diacritics-insensitive. */
export function mentionsFullName(subject: string, text: string): boolean {
  const parts = fold(subject).split(/[^\p{L}]+/u).filter(Boolean);
  if (parts.length < 2) return false;
  const sur = parts.at(-1) ?? "";
  const hay = fold(text);
  return [parts, [sur, ...parts.slice(0, -1)]].some((o) => new RegExp(`(?<!\\p{L})${o.map(escape).join("[\\s,._-]+")}(?!\\p{L})`, "u").test(hay));
}

/** Label of the first organisation token found as a whole word in text, or null. */
export function employerHit(text: string, tokens: readonly OrgToken[]): string | null {
  const hay = fold(text);
  return tokens.find((t) => hasWord(hay, t.token))?.label ?? null;
}

/** Excerpt plus the decoded URL: what a page is judged on. */
function pageText(s: { url: string; excerpt: string }): string {
  try {
    return `${s.excerpt}\n${decodeURIComponent(s.url)}`;
  } catch {
    return `${s.excerpt}\n${s.url}`;
  }
}

/** Why a page is about the subject: full name and an employer token, both present; null otherwise. */
export function corroborationReason(subject: string, tokens: readonly OrgToken[], s: { url: string; excerpt: string }): string | null {
  const text = pageText(s);
  if (!mentionsFullName(subject, text)) return null;
  const hit = employerHit(text, tokens);
  return hit === null ? null : `name and employer match (${hit})`;
}

/** The anchor's place as a folded word ("Prague, Czechia" -> "prague"); null for a URL, domain or IČO anchor. */
export function placeOf(anchor: string): string | null {
  const a = anchor.trim();
  if (a === "" || /^\d+$/.test(a) || (a.includes(".") && !/\s/.test(a))) return null;
  const first = fold(a.split(",")[0] ?? "").trim();
  return first.length >= 3 ? first : null;
}

export function mentionsPlace(anchor: string, text: string): boolean {
  const place = placeOf(anchor);
  return place !== null && hasWord(fold(text), place);
}

/** Personal-life details a hiring lineup must never cite: check-ins, profile pictures, family, hobbies. */
const PERSONAL =
  /check-?ins?\b|checked in|profile[- ](?:picture|photo|pic)|cover photo|avatar|\b(?:dad|daddy|mom|mommy|mum|mother|father|wife|husband|kids?|children|son|daughter|family|married|parent|parenthood)\b|hobb(?:y|ies)|addict|enthusiast|\blover\b|passionate about|\bfan of\b/i;

export function isPersonalDetail(text: string): boolean {
  return PERSONAL.test(text);
}

/** Reasons that cite only professional identifiers (name, handle, headline, employer, location, cross-links). */
export function professionalReasons(reasons: readonly string[]): string[] {
  return reasons.filter((r) => !isPersonalDetail(r));
}

/** Snippet with personal segments ("Dad, Rugby Addict") removed; "|"/"•"/"·" segments first, then comma parts. */
export function professionalSnippet(snippet: string): string {
  if (!isPersonalDetail(snippet)) return snippet;
  return snippet
    .split(/\s*[|•·]\s*/)
    .map((seg) => seg.split(/\s*,\s*/).filter((part) => !isPersonalDetail(part)).join(", "))
    .filter((seg) => seg.trim() !== "")
    .join(" | ");
}
