/**
 * Pure helpers for the positions pages: grouping, search, ingest label, must-have editing.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/position-links.ts
 * Deps:    src/domain/position, src/domain/corroborate (fold)
 * Tested:  src/domain/__tests__/position-links.test.ts
 *
 * Key responsibilities:
 * - groupByFamily / indexPositions / filterPositions for the list
 * - ingestLabel for the ingest method chip
 * - addMustHave / removeMustHave for the inline editor
 *
 * Design constraints:
 * - Pure, no I/O, no React
 * - Must-have ids start with mh- and stay unique; the list stays within 1..5 items
 */
import { fold } from "@/domain/corroborate";
import { FAMILIES, type Family, kebab, MAX_MUST_HAVES, type MustHave, type PositionListItem } from "@/domain/position";

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

export type FamilyGroup = { family: Family; items: PositionListItem[] };

/** Sections in FAMILIES order (other last), empty ones skipped, newest first inside; one pass over the items. */
export function groupByFamily(items: readonly PositionListItem[]): FamilyGroup[] {
  const buckets = new Map<Family, PositionListItem[]>();
  for (const i of items) {
    const bucket = buckets.get(i.family);
    if (bucket) bucket.push(i);
    else buckets.set(i.family, [i]);
  }
  return FAMILIES.flatMap((family) => {
    const list = buckets.get(family);
    return list ? [{ family, items: list.sort((a, b) => b.created_at.localeCompare(a.created_at)) }] : [];
  });
}

export type IndexedPosition = { item: PositionListItem; haystack: string };

/** Folds title and company once, so typing in the search box does not refold every row. */
export function indexPositions(items: readonly PositionListItem[]): IndexedPosition[] {
  return items.map((item) => ({ item, haystack: fold(`${item.title} ${item.company ?? ""}`) }));
}

export function filterPositions(index: readonly IndexedPosition[], query: string): PositionListItem[] {
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
