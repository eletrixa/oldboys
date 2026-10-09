/**
 * Public position summary for the start form: id, title and must-haves, nothing else.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/[id]/summary/summary.ts
 * Deps:    ../../handler (loadPosition), src/app/api/_lib/session
 * Tested:  src/app/api/positions/[id]/summary/__tests__/summary.test.ts
 *
 * Key responsibilities:
 * - `getPositionSummary`: the shared `loadPosition` read, cut to id, title and must-haves {id, title?, text}
 * - `getPositionSummaryRoute`: 200 with the summary, 404 `{error}` for an unknown id, another organization's position or no session
 *
 * Design constraints:
 * - No bearer by design (specs/positions-pages.md): it exposes only what the public run page already shows
 *   (title and must-have questions); never company, posting URL, excerpt, accepted_evidence or run lists
 * - Read only for a session and only within its organization: the start form that calls it is behind login
 * - Takes the D1 binding as a parameter so tests run under plain Node; no Next.js imports
 * - Every response carries `Cache-Control: no-store`
 */
import { sessionFromRequest } from "@/app/api/_lib/session";
import { loadPosition } from "../../handler";

export type PositionSummary = { id: string; title: string; must_haves: { id: string; title?: string; text: string }[] };

export async function getPositionSummary(db: D1Database, id: string, organizationId: string): Promise<PositionSummary | null> {
  const position = await loadPosition(db, id, organizationId);
  if (!position) return null;
  const must_haves = position.must_haves.map((m) => ({ id: m.id, ...(m.title === undefined ? {} : { title: m.title }), text: m.text }));
  return { id: position.id, title: position.title, must_haves };
}

export async function getPositionSummaryRoute(request: Request, db: D1Database, id: string): Promise<Response> {
  const user = await sessionFromRequest(request, db);
  const summary = user === null ? null : await getPositionSummary(db, id, user.organizationId);
  const res = summary ? Response.json(summary) : Response.json({ error: "position not found" }, { status: 404 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
