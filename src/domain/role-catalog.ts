/**
 * Role catalog: 100+ preselected company roles, each with must-haves and an evidence plan, plus the pure matcher.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog.ts
 * Deps:    src/domain/role-catalog/* (per-family data), src/domain/position (MustHaves schema)
 * Tested:  src/domain/__tests__/role-catalog.test.ts
 *
 * Key responsibilities:
 * - `ROLE_CATALOG`: every template, families concatenated; `ROLE_OPTIONS` (title, family, aliases) for the start form picker
 * - `filterRoleOptions`: substring search over title, aliases and family, ranked title-prefix first; the picker's one rule
 * - `matchRoleTemplate`: free-text role ("Senior Data Engineer, Prague, hybrid") -> the template whose title or alias
 *   names it; seniority words and the location/work-mode tail are ignored; longest alias wins on containment
 * - `templateToRow` / `templateFromRow`: the D1 `role_templates` row shape (JSON columns) both ways
 * - `roleSitesQuery`: the `site:` clause for the role's evidence sites, used by the hiring `role_sites_serp` step
 *
 * Design constraints:
 * - Pure, no I/O; the seed migration is generated from `ROLE_CATALOG` by `scripts/role-catalog-sql.ts`
 * - A match is a whole-phrase hit on a normalised title; never a fuzzy guess (a wrong template poisons the questions)
 */
import { parseMustHaves } from "./position";
import { DATA } from "./role-catalog/data";
import { DESIGN } from "./role-catalog/design";
import { ENGINEERING } from "./role-catalog/engineering";
import { FINANCE } from "./role-catalog/finance";
import { MARKETING } from "./role-catalog/marketing";
import { OPERATIONS } from "./role-catalog/operations";
import { OTHER } from "./role-catalog/other";
import { PEOPLE } from "./role-catalog/people";
import { PRODUCT } from "./role-catalog/product";
import { SALES } from "./role-catalog/sales";
import type { RoleTemplate } from "./role-catalog/types";

export type { HiringEvidenceStep, RoleProfileId, RoleTemplate } from "./role-catalog/types";
export { HIRING_EVIDENCE_STEPS } from "./role-catalog/types";

export const ROLE_CATALOG: readonly RoleTemplate[] = [...ENGINEERING, ...DATA, ...PRODUCT, ...DESIGN, ...MARKETING, ...SALES, ...OPERATIONS, ...FINANCE, ...PEOPLE, ...OTHER];

/** What the start form picker needs per role: nothing of the must-haves or sources reaches the client. */
export type RoleOption = Pick<RoleTemplate, "title" | "family" | "aliases">;

export const ROLE_OPTIONS: readonly RoleOption[] = ROLE_CATALOG.map(({ title, family, aliases }) => ({ title, family, aliases }));

/** Canonical titles, family order. */
export const ROLE_TITLES: readonly string[] = ROLE_CATALOG.map((t) => t.title);

/**
 * Options whose title, an alias or the family contains every word of `query` (case-insensitive), ranked: title starts
 * with the query, title contains it, an alias matches, family matches; stable within a rank. Empty query = all, capped.
 */
export function filterRoleOptions(query: string, options: readonly RoleOption[], limit = 12): RoleOption[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (q === "") return options.slice(0, limit);
  const words = q.split(" ");
  const has = (text: string): boolean => words.every((w) => text.includes(w));
  const rank = (o: RoleOption): number => {
    const title = o.title.toLowerCase();
    if (title.startsWith(q)) return 0;
    if (has(title)) return 1;
    if (o.aliases.some(has)) return 2;
    if (has(o.family)) return 3;
    return -1;
  };
  return options
    .map((o, i) => ({ o, i, r: rank(o) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.o);
}

/** D1 `role_templates` row (migrations/0013_role_templates.sql). */
export type RoleTemplateRow = {
  key: string;
  title: string;
  family: string;
  aliases_json: string;
  profile: string;
  must_haves_json: string;
  sources_json: string;
};

export function templateToRow(t: RoleTemplate): RoleTemplateRow {
  return {
    key: t.key,
    title: t.title,
    family: t.family,
    aliases_json: JSON.stringify(t.aliases),
    profile: t.profile,
    must_haves_json: JSON.stringify(t.must_haves),
    sources_json: JSON.stringify(t.sources),
  };
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

/** Row back to a template; null when a JSON column is unreadable (a broken row must never match). */
export function templateFromRow(row: RoleTemplateRow): RoleTemplate | null {
  const aliases = parseJson(row.aliases_json);
  const mustHaves = parseMustHaves(row.must_haves_json);
  const sources = parseJson(row.sources_json);
  if (!isStringArray(aliases) || mustHaves === null) return null;
  if (typeof sources !== "object" || sources === null || !isStringArray((sources as { steps?: unknown }).steps) || !isStringArray((sources as { sites?: unknown }).sites)) return null;
  return {
    key: row.key,
    title: row.title,
    family: row.family as RoleTemplate["family"],
    aliases,
    profile: row.profile as RoleTemplate["profile"],
    must_haves: mustHaves,
    sources: sources as RoleTemplate["sources"],
  };
}

const LEVEL_WORDS = /\b(senior|junior|sr\.?|jr\.?|mid-?level|medior|lead|principal|staff|intern|trainee|associate|experienced|seniorní|juniorní|zkušený)\b/g;
const TAIL_NOISE = /(?:^|\s)(?:m\/[fžw]|f\/m|w\/m|d\/f\/m|ž\/m|all genders)(?=\s|$)|\s(?:i{1,3}|iv|v)$/g;

/** Lower case, punctuation (except &+./#-) to spaces, single-spaced, trimmed; the same cleaning for role text and catalog names. */
function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}&+./#-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(role: string, keepLevels: boolean): string {
  const head = role.split(/[,|–—]/)[0] ?? role;
  const cleaned = clean(head).replace(TAIL_NOISE, " ");
  return clean(keepLevels ? cleaned : cleaned.replace(LEVEL_WORDS, " "));
}

/** Role text to the comparable title: before the first comma, lower case, level words and gender tags removed. */
export function normalizeRoleTitle(role: string): string {
  return normalize(role, false);
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Named = Pick<RoleTemplate, "key" | "title" | "aliases">;

/**
 * The template a role text names, or null. The text is compared twice: with its level words ("Staff Engineer",
 * "Senior Product Manager" are catalog titles of their own) and without them. Exact match on title or alias first;
 * otherwise the template whose longest alias occurs as a whole phrase ("backend engineer (go)" -> backend engineer).
 */
export function matchRoleTemplate<T extends Named>(role: string, templates: readonly T[]): T | null {
  const full = normalize(role, true);
  const bare = normalize(role, false);
  const titles = full === bare ? [full] : [full, bare];
  if (bare === "") return null;
  const names = (t: Named): string[] => [t.title, ...t.aliases].map(clean);
  for (const title of titles) {
    const exact = templates.find((t) => names(t).includes(title));
    if (exact !== undefined) return exact;
  }
  for (const title of titles) {
    let best: { t: T; len: number } | null = null;
    for (const t of templates) {
      for (const name of names(t)) {
        if (name.length <= (best?.len ?? 0)) continue;
        if (new RegExp(`(?:^|\\s)${escapeRe(name)}(?:\\s|$)`, "u").test(title)) best = { t, len: name.length };
      }
    }
    if (best !== null) return best.t;
  }
  return null;
}

/** `site:a OR site:b` for a Google query; empty string when there are no sites. */
export function roleSitesQuery(sites: readonly string[]): string {
  return sites.map((s) => `site:${s}`).join(" OR ");
}
