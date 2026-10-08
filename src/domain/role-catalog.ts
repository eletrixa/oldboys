/**
 * Role catalog: 100+ preselected company roles, each with must-haves and an evidence plan, plus the pure matcher.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog.ts
 * Deps:    src/domain/role-catalog/* (per-family data), src/domain/position (MustHaves schema)
 * Tested:  src/domain/__tests__/role-catalog.test.ts
 *
 * Key responsibilities:
 * - `ROLE_CATALOG`: every template, families concatenated; `ROLE_TITLES` for the start form datalist
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

/** Canonical titles, family order, for the start form datalist. */
export const ROLE_TITLES: readonly string[] = ROLE_CATALOG.map((t) => t.title);

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
const TAIL_NOISE = /\((?:m\/[fžw]|f\/m|w\/m|d\/f\/m|all genders)\)|\b(?:m\/ž|ž\/m|m\/f|f\/m)\b|\b(?:i{1,3}|iv|v)\b$/g;

/** Role text to the comparable title: before the first comma, lower case, level words and gender tags removed. */
export function normalizeRoleTitle(role: string): string {
  const head = role.split(/[,|–—]/)[0] ?? role;
  return head
    .toLowerCase()
    .replace(TAIL_NOISE, " ")
    .replace(LEVEL_WORDS, " ")
    .replace(/[^\p{L}\p{N}&+./#-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Named = Pick<RoleTemplate, "key" | "title" | "aliases">;

/**
 * The template a role text names, or null. Exact match on title or alias first; otherwise the template whose
 * longest alias occurs as a whole phrase in the normalised title ("backend engineer (go)" -> backend engineer).
 */
export function matchRoleTemplate<T extends Named>(role: string, templates: readonly T[]): T | null {
  const title = normalizeRoleTitle(role);
  if (title === "") return null;
  const names = (t: Named): string[] => [t.title.toLowerCase(), ...t.aliases.map((a) => a.toLowerCase())];
  const exact = templates.find((t) => names(t).includes(title));
  if (exact !== undefined) return exact;
  let best: { t: T; len: number } | null = null;
  for (const t of templates) {
    for (const name of names(t)) {
      if (name.length <= (best?.len ?? 0)) continue;
      if (new RegExp(`(?:^|\\s)${escapeRe(name)}(?:\\s|$)`, "u").test(title)) best = { t, len: name.length };
    }
  }
  return best?.t ?? null;
}

/** `site:a OR site:b` for a Google query; empty string when there are no sites. */
export function roleSitesQuery(sites: readonly string[]): string {
  return sites.map((s) => `site:${s}`).join(" OR ");
}
