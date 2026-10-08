/**
 * Public position summary for the start form: id, title and must-haves, nothing else.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/[id]/summary/summary.ts
 * Deps:    ../../handler (loadPosition)
 * Tested:  src/app/api/positions/[id]/summary/__tests__/summary.test.ts
 *
 * Key responsibilities:
 * - `getPositionSummary`: the shared `loadPosition` read, cut to id, title and must-haves {id, title?, text}
 * - `getPositionSummaryRoute`: 200 with the summary, 404 `{error}` for an unknown id
 *
 * Design constraints:
 * - No bearer by design (specs/positions-pages.md): it exposes only what the public run page already shows
 *   (title and must-have questions); never company, posting URL, excerpt, accepted_evidence or run lists
 * - Takes the D1 binding as a parameter so tests run under plain Node; no Next.js imports
 * - Every response carries `Cache-Control: no-store`
 */
import { loadPosition } from "../../handler";

export type PositionSummary = { id: string; title: string; must_haves: { id: string; title?: string; text: string }[] };

export async function getPositionSummary(db: D1Database, id: string): Promise<PositionSummary | null> {
  const position = await loadPosition(db, id);
  if (!position) return null;
  const must_haves = position.must_haves.map((m) => ({ id: m.id, ...(m.title === undefined ? {} : { title: m.title }), text: m.text }));
  return { id: position.id, title: position.title, must_haves };
}

export async function getPositionSummaryRoute(db: D1Database, id: string): Promise<Response> {
  const summary = await getPositionSummary(db, id);
  const res = summary ? Response.json(summary) : Response.json({ error: "position not found" }, { status: 404 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
