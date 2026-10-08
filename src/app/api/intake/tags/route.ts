/**
 * GET and POST /api/intake/tags: list the open positions' routing tags, create one without a SQL console.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/intake/tags/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), binding DB, secret RUN_TOKEN, ./tag-body, src/app/api/_lib/{auth,body}, src/app/intake/intake-rows (type)
 * Tested:  schema and duplicate classifier in ./__tests__/tag-body.test.ts; route n/a (QA pass, like /api/roles)
 *
 * Key responsibilities:
 * - GET: all intake_tags rows newest first -> { tags }
 * - POST {tag, role? (or positionId, then the position's title), goal?, startupjobsOfferId?}: 201 with the stored tag, 400 invalid body, 404 unknown positionId, 409 when the tag or the StartupJobs offer id exists
 * - Bearer auth against RUN_TOKEN on both methods
 *
 * Design constraints:
 * - No runtime = "edge"
 * - Uniqueness is decided by the database constraint, not a read-then-write check, so two concurrent creates cannot both win
 * - Database error text is logged, never returned
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireBearer } from "@/app/api/_lib/auth";
import { parseJsonBody } from "@/app/api/_lib/body";
import type { TagRow } from "@/app/intake/intake-rows";
import { duplicateField, TagBody } from "./tag-body";

const COLUMNS = "tag, role, goal, startupjobs_offer_id, position_id, created_at";

export async function GET(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return denied;

  const rows = await env.DB.prepare(`SELECT ${COLUMNS} FROM intake_tags ORDER BY created_at DESC, tag`).all<TagRow>();
  return Response.json({ tags: rows.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return denied;

  const body = await parseJsonBody(request, TagBody);
  if (body.error) return body.error;
  const { tag, goal, startupjobsOfferId, positionId } = body.data;

  let role = body.data.role;
  if (positionId !== undefined) {
    const position = await env.DB.prepare("SELECT title FROM positions WHERE id = ?").bind(positionId).first<{ title: string }>();
    if (!position) return Response.json({ error: "position not found" }, { status: 404 });
    role ??= position.title;
  }
  if (role === undefined) return Response.json({ error: "role or positionId is required" }, { status: 400 });

  const created: TagRow = {
    tag,
    role,
    goal,
    startupjobs_offer_id: startupjobsOfferId ?? null,
    position_id: positionId ?? null,
    created_at: new Date().toISOString(),
  };
  try {
    await env.DB.prepare(`INSERT INTO intake_tags (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(created.tag, created.role, created.goal, created.startupjobs_offer_id, created.position_id, created.created_at)
      .run();
  } catch (err) {
    const field = duplicateField(err);
    if (field === "tag") return Response.json({ error: "tag already exists" }, { status: 409 });
    if (field === "startupjobs_offer_id") return Response.json({ error: "StartupJobs offer id already mapped to another tag" }, { status: 409 });
    console.error("intake tag insert failed:", err);
    return Response.json({ error: "could not save the tag" }, { status: 500 });
  }
  return Response.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
}
