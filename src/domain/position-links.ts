/**
 * Pure helpers for the positions pages: grouping, search, ingest label, must-have editing.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/position-links.ts
 * Deps:    src/domain/position, src/domain/corroborate (fold), src/domain/role-catalog (RoleOption type)
 * Tested:  src/domain/__tests__/position-links.test.ts
 *
 * Key responsibilities:
 * - titleChoices: the selector's rows = the team's ingested positions (newest first) plus every catalog title not
 *   already ingested; a title only, never the company
 * - groupByFamily / indexTitles / filterTitles for the list
 * - ingestLabel for the ingest method chip; positionOrigin: "From the role catalog" vs the ingest label, and "edited" only after a real edit
 * - addMustHave / removeMustHave for the inline editor
 *
 * Design constraints:
 * - Pure, no I/O, no React
 * - Must-have ids start with mh- and stay unique; the list stays within 1..5 items
 */
import { fold } from "@/domain/corroborate";
import { FAMILIES, type Family, kebab, MAX_MUST_HAVES, type MustHave, type Position, type PositionListItem } from "@/domain/position";
import type { RoleOption } from "@/domain/role-catalog";

const INGEST_LABELS: Readonly<Record<string, string>> = {
  pasted: "Pasted",
  manual: "Entered by hand",
  "jobs-cz": "Jobs.cz",
  startupjobs: "StartupJobs",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  jsonld: "Posting page",
};

/** Human label for how the posting came in; unknown values pass through. */
export function ingestLabel(method: string): string {
  return INGEST_LABELS[method] ?? method;
}

/** Field by field, never key order (the stored must-haves come back through the Zod schema in its own key order). */
const mustHaveKey = (m: MustHave): string => JSON.stringify([m.id, m.title ?? null, m.text, m.accepted_evidence]);
const sameMustHaves = (a: readonly MustHave[], b: readonly MustHave[]): boolean =>
  a.length === b.length && a.every((m, i) => b[i] !== undefined && mustHaveKey(m) === mustHaveKey(b[i]));

/**
 * Where a position came from and whether a person changed its must-haves since. `catalog` = the role-catalog template's
 * must-haves when the position was created from that catalog title (null otherwise): such a position reads "From the role
 * catalog", "edited" only once its must-haves differ from the template (ingest stores catalog must-haves as `edited`).
 */
export function positionOrigin(
  position: Pick<Position, "ingest_method" | "extraction" | "must_haves">,
  catalog: readonly MustHave[] | null,
): { label: string; edited: boolean } {
  if (catalog !== null) return { label: "From the role catalog", edited: !sameMustHaves(position.must_haves, catalog) };
  return { label: ingestLabel(position.ingest_method), edited: position.extraction === "edited" };
}

/** One selectable title: an ingested position (its page, run count) or a preselected catalog role (the start form). */
export type TitleChoice = { title: string; family: Family; href: string; runs: number | null; posting_url: string | null };

/** Ingested positions newest first, then catalog titles whose folded title is not an ingested one. Companies never appear. */
export function titleChoices(catalog: readonly RoleOption[], positions: readonly PositionListItem[]): TitleChoice[] {
  const ingested = [...positions]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((p): TitleChoice => ({ title: p.title, family: p.family, href: `/positions/${encodeURIComponent(p.id)}`, runs: p.runs, posting_url: p.posting_url }));
  const taken = new Set(ingested.map((c) => fold(c.title)));
  const preset = catalog
    .filter((o) => !taken.has(fold(o.title)))
    .map((o): TitleChoice => ({ title: o.title, family: o.family, href: `/briefs/new?role=${encodeURIComponent(o.title)}`, runs: null, posting_url: null }));
  return [...ingested, ...preset];
}

export type FamilyGroup<T> = { family: Family; items: T[] };

/** Sections in FAMILIES order (other last), empty ones skipped, input order kept inside; one pass over the items. */
export function groupByFamily<T extends { family: Family }>(items: readonly T[]): FamilyGroup<T>[] {
  const buckets = new Map<Family, T[]>();
  for (const i of items) {
    const bucket = buckets.get(i.family);
    if (bucket) bucket.push(i);
    else buckets.set(i.family, [i]);
  }
  return FAMILIES.flatMap((family) => {
    const list = buckets.get(family);
    return list ? [{ family, items: list }] : [];
  });
}

export type IndexedTitle<T> = { item: T; haystack: string };

/** Folds each title once, so typing in the search box does not refold every row. */
export function indexTitles<T extends { title: string }>(items: readonly T[]): IndexedTitle<T>[] {
  return items.map((item) => ({ item, haystack: fold(item.title) }));
}

export function filterTitles<T>(index: readonly IndexedTitle<T>[], query: string): T[] {
  const q = fold(query.trim());
  return index.filter((e) => q === "" || e.haystack.includes(q)).map((e) => e.item);
}

function slug(s: string): string {
  return kebab(fold(s)).slice(0, 32) || "item";
}

/** Appends a must-have with a unique mh- id from the title (or text); no-op at 5 items. */
export function addMustHave(list: readonly MustHave[], title: string, text: string): MustHave[] {
  if (list.length >= MAX_MUST_HAVES) return [...list];
  const base = `mh-${slug(title.trim() === "" ? text : title)}`;
  const taken = new Set(list.map((m) => m.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${String(n)}`;
  const t = title.trim();
  return [...list, { id, text: text.trim(), ...(t !== "" ? { title: t } : {}), accepted_evidence: [] }];
}

/** Removes one item but never the last. */
export function removeMustHave(list: readonly MustHave[], id: string): MustHave[] {
  return list.length <= 1 ? [...list] : list.filter((m) => m.id !== id);
}
