/**
 * /api/positions D1 logic: list, read, edit positions and the one read path shared with the public summary.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/handler.ts
 * Deps:    src/app/api/_lib/{position-body,role-rows}, src/domain/{position,role-overview}
 * Tested:  src/app/api/positions/__tests__/handler.test.ts
 *
 * Key responsibilities:
 * - `loadPosition`: the single read path for one position (also used by the public summary); never returns `r2_key`
 * - `listPositions`, `getPosition`, `patchPosition`: plain D1 reads and writes
 * - `must_haves_json` is parsed on the way out; a malformed value becomes `[]` and never throws
 * - `getPosition`: `runs` and the overview `group` both come from the position's hiring run rows (one query)
 *
 * Design constraints:
 * - Takes the D1 binding as a parameter so tests run under plain Node; no Next.js imports
 * - PATCH writes only the given columns, marks edited must-haves `extraction = 'edited'`, and never touches `expires_at` or the questions of existing runs
 * - The bearer-guarded route functions live in routes.ts
 */
import { loadRoleRunRows } from "@/app/api/_lib/role-rows";
import type { PatchPositionBody } from "@/app/api/_lib/position-body";
import { parseMustHaves, POSITION_ID, type Position, type PositionListItem } from "@/domain/position";
import { buildGroup, type RoleGroup } from "@/domain/role-overview";

export type PositionRun = { id: string; subject: string; status: string; created_at: string };
export type PositionDetail = { position: Position; runs: PositionRun[]; group: RoleGroup | null };

const MAX_LIST = 500;
const COLUMNS =
  "id, title, family, company, location, board, posting_url, external_id, must_haves_json, excerpt, ingest_method, ingest_cost_usd, created_at, expires_at, extraction";

type PositionRow = Record<string, string | number | null>;

function toPosition(row: PositionRow): Position {
  const optional = (key: string) => (typeof row[key] === "string" ? { [key]: row[key] } : {});
  return {
    id: String(row.id),
    title: String(row.title),
    family: row.family as Position["family"],
    ...optional("company"),
    ...optional("location"),
    ...optional("board"),
    ...optional("posting_url"),
    ...optional("external_id"),
    must_haves: parseMustHaves(row.must_haves_json) ?? [],
    excerpt: typeof row.excerpt === "string" ? row.excerpt : "",
    ingest_method: row.ingest_method as Position["ingest_method"],
    ingest_cost_usd: Number(row.ingest_cost_usd),
    created_at: String(row.created_at),
    expires_at: String(row.expires_at),
    extraction: row.extraction as Position["extraction"],
  };
}

export async function loadPosition(db: D1Database, id: string): Promise<Position | null> {
  const valid = POSITION_ID.safeParse(id);
  if (!valid.success) return null;
  const row = await db.prepare(`SELECT ${COLUMNS} FROM positions WHERE id = ?`).bind(valid.data).first<PositionRow>();
  return row ? toPosition(row) : null;
}

export async function listPositions(db: D1Database): Promise<PositionListItem[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.title, p.family, p.company, p.location, p.posting_url, p.ingest_method, p.created_at, p.expires_at, COUNT(i.id) AS runs
       FROM positions p LEFT JOIN investigations i ON i.position_id = p.id
       GROUP BY p.id ORDER BY p.created_at DESC LIMIT ?`,
    )
    .bind(MAX_LIST)
    .all<PositionListItem>();
  return results;
}

export async function getPosition(db: D1Database, id: string): Promise<PositionDetail | null> {
  if (!POSITION_ID.safeParse(id).success) return null;
  const [position, rows] = await Promise.all([loadPosition(db, id), loadRoleRunRows(db, "i.position_id = ? AND i.goal = 'hiring'", [id])]);
  if (!position) return null;
  return {
    position,
    runs: rows.map(({ id: runId, subject, status, created_at }) => ({ id: runId, subject, status, created_at })),
    group: rows.length === 0 ? null : { ...buildGroup(position.id, rows), role: position.title },
  };
}

export async function patchPosition(db: D1Database, id: string, body: PatchPositionBody): Promise<Position | null> {
  if (!POSITION_ID.safeParse(id).success) return null;
  const sets: [column: string, value: string][] = [];
  if (body.title !== undefined) sets.push(["title", body.title]);
  if (body.family !== undefined) sets.push(["family", body.family]);
  if (body.must_haves !== undefined) sets.push(["must_haves_json", JSON.stringify(body.must_haves)], ["extraction", "edited"]);
  const written = await db
    .prepare(`UPDATE positions SET ${sets.map(([c]) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .bind(...sets.map(([, v]) => v), id)
    .run();
  return written.meta.changes === 0 ? null : loadPosition(db, id);
}
