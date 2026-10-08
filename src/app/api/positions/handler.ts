/**
 * /api/positions logic: list, read, edit and create (ingest) positions, plus the bearer-guarded route functions.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/positions/handler.ts
 * Deps:    src/app/api/_lib/{auth,body,position-body}, src/domain/{position,position-overview,role-overview}, src/workflow/ingest-position, src/adapters/llm
 * Tested:  src/app/api/positions/__tests__/handler.test.ts
 *
 * Key responsibilities:
 * - `listPositions`, `getPosition`, `patchPosition`: plain D1 reads and writes, never returning `r2_key`
 * - `must_haves_json` is parsed on the way out; a malformed value becomes `[]` and never throws
 * - `createPositionRoute`, `listPositionsRoute`, `getPositionRoute`, `patchPositionRoute`: bearer first, then body, then the tested function
 *
 * Design constraints:
 * - Takes bindings as parameters so tests run under plain Node; no Next.js imports
 * - Every response, errors included, carries `Cache-Control: no-store`
 * - PATCH writes only the given columns and never touches `expires_at` or the questions of existing runs
 */
import { makeLlmCall } from "@/adapters/llm";
import { requireBearer } from "@/app/api/_lib/auth";
import { parseJsonBody } from "@/app/api/_lib/body";
import { CreatePositionBody, PatchPositionBody } from "@/app/api/_lib/position-body";
import { MustHaves, type MustHave, type Position } from "@/domain/position";
import { positionOverview } from "@/domain/position-overview";
import type { RoleGroup, RoleRunRow } from "@/domain/role-overview";
import { estimatePositionUsd, ingestCapUsd, ingestPosition, type IngestDeps } from "@/workflow/ingest-position";

export type PositionsEnv = {
  DB: D1Database;
  SOURCES: R2Bucket;
  RUN_TOKEN?: string;
  POSITION_INGEST_USD?: string;
  ANTHROPIC_API_KEY?: string;
  LLM_MODEL_PRIMARY?: string;
  LLM_MODEL_VERIFY?: string;
};

export type PositionRun = { id: string; subject: string; status: string; created_at: string };
export type PositionListItem = Pick<Position, "id" | "title" | "family" | "ingest_method" | "created_at" | "expires_at"> & {
  company: string | null;
  location: string | null;
  posting_url: string | null;
  runs: number;
};
export type PositionDetail = { position: Position; runs: PositionRun[]; group: RoleGroup | null };

const MAX_ID = 64;
const MAX_LIST = 500;
const MAX_RUNS = 200;
const COLUMNS =
  "id, title, family, company, location, board, posting_url, external_id, must_haves_json, excerpt, ingest_method, ingest_cost_usd, created_at, expires_at, extraction";

type PositionRow = Record<string, string | number | null>;

function mustHavesOf(json: unknown): MustHave[] {
  try {
    const parsed = MustHaves.safeParse(JSON.parse(String(json)));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

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
    must_haves: mustHavesOf(row.must_haves_json),
    excerpt: typeof row.excerpt === "string" ? row.excerpt : "",
    ingest_method: row.ingest_method as Position["ingest_method"],
    ingest_cost_usd: Number(row.ingest_cost_usd),
    created_at: String(row.created_at),
    expires_at: String(row.expires_at),
    extraction: row.extraction as Position["extraction"],
  };
}

async function loadPosition(db: D1Database, id: string): Promise<Position | null> {
  if (id.length > MAX_ID) return null;
  const row = await db.prepare(`SELECT ${COLUMNS} FROM positions WHERE id = ?`).bind(id).first<PositionRow>();
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
  const position = await loadPosition(db, id);
  if (!position) return null;
  const [runs, rows] = await Promise.all([
    db
      .prepare("SELECT id, subject, status, created_at FROM investigations WHERE position_id = ? ORDER BY created_at DESC LIMIT ?")
      .bind(id, MAX_RUNS)
      .all<PositionRun>(),
    db
      .prepare(
        `SELECT i.id, i.subject, i.role, i.status, i.created_at, i.questions_json, b.brief_json,
           (SELECT COUNT(*) FROM sources s WHERE s.run_id = i.id AND s.identity = 'merged') AS sources_confirmed
         FROM investigations i LEFT JOIN briefs b ON b.run_id = i.id
         WHERE i.position_id = ? AND i.goal = 'hiring'
         ORDER BY i.created_at DESC LIMIT ?`,
      )
      .bind(id, MAX_LIST)
      .all<RoleRunRow>(),
  ]);
  return { position, runs: runs.results, group: positionOverview(rows.results, position) };
}

export async function patchPosition(db: D1Database, id: string, body: PatchPositionBody): Promise<Position | null> {
  if (id.length > MAX_ID) return null;
  const sets: [column: string, value: string][] = [];
  if (body.title !== undefined) sets.push(["title", body.title]);
  if (body.family !== undefined) sets.push(["family", body.family]);
  if (body.must_haves !== undefined) sets.push(["must_haves_json", JSON.stringify(body.must_haves)]);
  const written = await db
    .prepare(`UPDATE positions SET ${sets.map(([c]) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .bind(...sets.map(([, v]) => v), id)
    .run();
  return written.meta.changes === 0 ? null : loadPosition(db, id);
}

const noStore = (res: Response): Response => {
  res.headers.set("Cache-Control", "no-store");
  return res;
};
const json = (body: unknown, status = 200): Response => noStore(Response.json(body, { status }));
const notFound = (): Response => json({ error: "position not found" }, 404);

export async function createPositionRoute(request: Request, env: PositionsEnv, over: Partial<IngestDeps> = {}): Promise<Response> {
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return noStore(denied);
  const parsed = await parseJsonBody(request, CreatePositionBody);
  if (parsed.error) return noStore(parsed.error);
  const llm = makeLlmCall(env.ANTHROPIC_API_KEY ?? "", {
    primary: env.LLM_MODEL_PRIMARY ?? "claude-opus-5-5",
    verify: env.LLM_MODEL_VERIFY ?? "claude-sonnet-5-5",
  });
  const result = await ingestPosition(
    {
      db: env.DB,
      bucket: env.SOURCES,
      ports: { llm },
      fetchFn: fetch,
      now: new Date(),
      newId: () => crypto.randomUUID(),
      capUsd: ingestCapUsd(env.POSITION_INGEST_USD),
      estimateUsd: estimatePositionUsd,
      ...over,
    },
    parsed.data,
  );
  if (!result.ok) return json({ error: result.error }, result.status);
  return result.reused ? json({ id: result.id, reused: true }) : json({ id: result.id, notes: result.notes }, 201);
}

export async function listPositionsRoute(request: Request, env: PositionsEnv): Promise<Response> {
  const denied = requireBearer(request, env.RUN_TOKEN);
  return denied ? noStore(denied) : json({ positions: await listPositions(env.DB) });
}

export async function getPositionRoute(request: Request, env: PositionsEnv, id: string): Promise<Response> {
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return noStore(denied);
  const detail = await getPosition(env.DB, id);
  return detail ? json(detail) : notFound();
}

export async function patchPositionRoute(request: Request, env: PositionsEnv, id: string): Promise<Response> {
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return noStore(denied);
  const parsed = await parseJsonBody(request, PatchPositionBody);
  if (parsed.error) return noStore(parsed.error);
  const position = await patchPosition(env.DB, id, parsed.data);
  return position ? json({ position }) : notFound();
}
