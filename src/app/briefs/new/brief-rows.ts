/**
 * Pure helpers of the New brief wizard: candidate row drafts, their request bodies, the id list for enrichment, failure copy.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/new/brief-rows.ts
 * Deps:    none
 * Tested:  src/app/briefs/new/__tests__/brief-rows.test.ts
 *
 * Key responsibilities:
 * - DraftRow: one new candidate sourced by a LinkedIn URL, a pasted CV or a CV file
 * - rowReady / candidateBody: whether a row can be sent and the JSON body of POST /api/positions/:id/candidates (file rows go multipart)
 * - patchRow: an idempotent row update (returns the same array when nothing changes, so a child effect cannot loop)
 * - researchCount / enrichIds: how many people the button starts and the de-duplicated application ids for one enrich call
 * - failText: calm copy for a refused request (401, 429, other)
 * - nextAfterStart: where the page goes once research started (the run itself for one, the position's candidates for several)
 *
 * Design constraints:
 * - Pure, no I/O, no React; order of rows is kept (no ranking)
 */
export type RowSource = "linkedin" | "cv" | "file";
export type DraftRow = { key: string; source: RowSource; linkedinUrl: string; cvText: string; file: File | null };

export const emptyRow = (key: string): DraftRow => ({ key, source: "linkedin", linkedinUrl: "", cvText: "", file: null });

export function rowReady(row: DraftRow): boolean {
  if (row.source === "linkedin") return row.linkedinUrl.trim() !== "";
  if (row.source === "cv") return row.cvText.trim() !== "";
  return row.file !== null && row.file.size > 0;
}

/** JSON body for a LinkedIn or pasted-CV row; null for a file row or a row that is not ready. */
export function candidateBody(row: DraftRow): { linkedinUrl: string } | { cvText: string } | null {
  if (!rowReady(row)) return null;
  if (row.source === "linkedin") return { linkedinUrl: row.linkedinUrl.trim() };
  if (row.source === "cv") return { cvText: row.cvText.trim() };
  return null;
}

export function patchRow(rows: readonly DraftRow[], key: string, patch: Partial<Omit<DraftRow, "key">>): readonly DraftRow[] {
  const i = rows.findIndex((r) => r.key === key);
  const row = rows[i];
  if (row === undefined) return rows;
  if ((Object.keys(patch) as (keyof typeof patch)[]).every((k) => row[k] === patch[k])) return rows;
  return rows.map((r) => (r.key === key ? { ...r, ...patch } : r));
}

export function researchCount(rows: readonly DraftRow[], ticked: ReadonlySet<string>): number {
  return rows.filter(rowReady).length + ticked.size;
}

export function enrichIds(added: readonly string[], ticked: ReadonlySet<string>): string[] {
  return [...new Set([...added, ...ticked])];
}

export function failText(status: number, fallback: string): string {
  if (status === 401) return "You are logged out. Reload the page to log in again.";
  if (status === 429) return "The hourly research limit is reached. Your candidates are kept here; try again later.";
  return fallback;
}

export function nextAfterStart(positionId: string, started: readonly { runId: string }[]): string {
  const [only, ...rest] = started;
  if (only !== undefined && rest.length === 0) return `/runs/${encodeURIComponent(only.runId)}`;
  return `/positions/${encodeURIComponent(positionId)}#candidates`;
}
