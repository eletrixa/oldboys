/**
 * /api/positions D1 logic: list, read, edit positions and the one read path shared with the public summary.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/handler.ts
 * Deps:    src/app/api/_lib/{position-body,role-rows}, src/domain/{application (types),position,profile-stats,profile-url,role-overview}, src/recipe/goals, src/app/runs/[id]/source-labels, src/app/intake/intake-rows (TagRow type)
 * Tested:  src/app/api/positions/__tests__/handler.test.ts
 *
 * Key responsibilities:
 * - `loadPosition`: the single read path for one position (also used by the public summary); never returns `r2_key`
 * - `listPositions`, `getPosition`, `patchPosition`: plain D1 reads and writes
 * - `must_haves_json` is parsed on the way out; a malformed value becomes `[]` and never throws
 * - `getPosition`: `runs` and the overview `group` both come from the position's hiring run rows; `candidates` (the pool, newest first, max 200,
 *   never CV text, cover letter, external id or LinkedIn URL) and the bound intake `tags` are two more reads; each pool row carries its
 *   run's status, progress (from the last ledger step), fit % and independent-evidence count (briefStats) for the results table
 *
 * Design constraints:
 * - Takes the D1 binding as a parameter so tests run under plain Node; no Next.js imports
 * - PATCH writes only the given columns, marks edited must-haves `extraction = 'edited'`, and never touches `expires_at` or the questions of existing runs
 * - The bearer-guarded route functions live in routes.ts
 */
import { loadRoleRunRows } from "@/app/api/_lib/role-rows";
import type { PatchPositionBody } from "@/app/api/_lib/position-body";
import type { TagRow } from "@/app/intake/intake-rows";
import { STEP_LABEL } from "@/app/runs/[id]/source-labels";
import type { ApplicationSource, ApplicationStatus } from "@/domain/application";
import { parseMustHaves, POSITION_ID, type Position, type PositionListItem } from "@/domain/position";
import { briefStats } from "@/domain/profile-stats";
import { nameFromHandle } from "@/domain/profile-url";
import { buildGroup, type RoleGroup, type RoleRunRow } from "@/domain/role-overview";
import { recipeFor } from "@/recipe/goals";

export type PositionRun = { id: string; subject: string; status: string; created_at: string };
/** The pooled person's run as the results table shows it: progress while running, fit % and independent lines once done. */
export type PoolRun = { status: string; subject: string; step: string | null; pct: number; fit_pct: number | null; independent: number };
/**
 * One pooled person; `has_*` are 0/1 so the page can show presence without the CV or profile text. `handle` is the
 * name-like part of the LinkedIn URL (never the URL itself); `run` is null until a hiring run of this position exists.
 */
export type PoolRow = {
  id: string;
  source: ApplicationSource;
  name: string | null;
  email: string | null;
  status: ApplicationStatus;
  run_id: string | null;
  note: string | null;
  received_at: string;
  has_profile: number;
  has_cv: number;
  handle: string | null;
  run: PoolRun | null;
};
type PoolDbRow = Omit<PoolRow, "handle" | "run"> & { linkedin_url: string | null };
export type PositionDetail = { position: Position; runs: PositionRun[]; group: RoleGroup | null; candidates: PoolRow[]; tags: TagRow[] };

const MAX_LIST = 500;
const MAX_POOL = 200;
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

const HIRING_STEPS = recipeFor("hiring").steps;

/** Progress from the last step with a ledger row: the step label is the one now running, pct the share of steps done. */
function poolRun(row: RoleRunRow): PoolRun {
  const done = row.last_step === undefined || row.last_step === null ? 0 : HIRING_STEPS.findIndex((s) => s.id === row.last_step) + 1;
  const next = HIRING_STEPS[done];
  const actor = next !== undefined && "actor" in next ? next.actor : undefined;
  const active = row.status === "queued" || row.status === "running";
  const step = !active || next === undefined ? null : (actor === undefined ? undefined : STEP_LABEL[actor]) ?? next.id.replaceAll("_", " ");
  const pct = row.status === "done" ? 100 : Math.min(99, Math.round((done / HIRING_STEPS.length) * 100));
  return { status: row.status, subject: row.subject, step, pct, ...briefStats(row.brief_json) };
}

export async function getPosition(db: D1Database, id: string): Promise<PositionDetail | null> {
  if (!POSITION_ID.safeParse(id).success) return null;
  const [position, rows, candidates, tags] = await Promise.all([
    loadPosition(db, id),
    loadRoleRunRows(db, "i.position_id = ? AND i.goal = 'hiring'", [id]),
    db
      .prepare(
        `SELECT id, source, name, email, status, run_id, note, received_at, linkedin_url IS NOT NULL AS has_profile, cv_text IS NOT NULL AS has_cv, linkedin_url
         FROM applications WHERE position_id = ? ORDER BY received_at DESC, id DESC LIMIT ?`,
      )
      .bind(id, MAX_POOL)
      .all<PoolDbRow>(),
    db
      .prepare("SELECT tag, role, goal, company, startupjobs_offer_id, position_id, created_at FROM intake_tags WHERE position_id = ? ORDER BY created_at DESC, tag")
      .bind(id)
      .all<TagRow>(),
  ]);
  if (!position) return null;
  const byRun = new Map(rows.map((r) => [r.id, r]));
  return {
    position,
    runs: rows.map(({ id: runId, subject, status, created_at }) => ({ id: runId, subject, status, created_at })),
    group: rows.length === 0 ? null : { ...buildGroup(position.id, rows), role: position.title },
    candidates: candidates.results.map(({ linkedin_url, ...c }) => {
      const run = c.run_id === null ? undefined : byRun.get(c.run_id);
      return { ...c, handle: linkedin_url === null ? null : nameFromHandle(linkedin_url) || null, run: run === undefined ? null : poolRun(run) };
    }),
    tags: tags.results,
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
