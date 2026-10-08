/**
 * Pure helpers for the positions pages: grouping, search, outbound links, request bodies, must-have editing.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/position-links.ts
 * Deps:    src/domain/position, src/domain/corroborate (fold)
 * Tested:  src/domain/__tests__/position-links.test.ts
 *
 * Key responsibilities:
 * - groupByFamily / filterPositions for the list, linkedinPeopleSearchUrl / researchHref for the detail actions
 * - ingestLabel for the ingest method chip
 * - buildCreateBody for /positions/new, addMustHave / removeMustHave for the inline editor
 *
 * Design constraints:
 * - Pure, no I/O, no React
 * - Must-have ids start with mh- and stay unique; the list stays within 1..5 items
 */
import { fold } from "@/domain/corroborate";
import { FAMILIES, type Family, kebab, MAX_MUST_HAVES, type MustHave, type PositionListItem } from "@/domain/position";

const INGEST_LABELS: Readonly<Record<string, string>> = {
  pasted: "Pasted",
  "jobs-cz": "Jobs.cz",
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

/** Sections in FAMILIES order (other last), empty ones skipped, newest first inside. */
export function groupByFamily(items: readonly PositionListItem[]): FamilyGroup[] {
  return FAMILIES.map((family) => ({
    family,
    items: items.filter((i) => i.family === family).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  })).filter((g) => g.items.length > 0);
}

export function filterPositions(items: readonly PositionListItem[], query: string): PositionListItem[] {
  const q = fold(query.trim());
  if (q === "") return [...items];
  return items.filter((i) => fold(`${i.title} ${i.company ?? ""}`).includes(q));
}

export function linkedinPeopleSearchUrl(title: string, location?: string | null): string {
  const keywords = `${title} ${location ?? ""}`.trim();
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

export function researchHref(id: string): string {
  return `/?positionId=${encodeURIComponent(id)}`;
}

export type CreateInput = { postingText: string; postingUrl: string; title: string };

/** Trimmed body without empty fields; null when there is neither text nor URL to send. */
export function buildCreateBody(input: CreateInput): Record<string, string> | null {
  const text = input.postingText.trim();
  const url = input.postingUrl.trim();
  const title = input.title.trim();
  if (text === "" && url === "") return null;
  return { ...(text !== "" ? { postingText: text } : {}), ...(url !== "" ? { postingUrl: url } : {}), ...(title !== "" ? { title } : {}) };
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
