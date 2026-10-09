/**
 * Start enrichment for chosen candidates of a position's pool: one research run per candidate, with the position's must-haves as questions.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/enrich.ts
 * Deps:    src/workflow/start-run (startRun, runRoom), bindings DB + RESEARCH_RUN
 * Tested:  src/workflow/__tests__/enrich.test.ts
 *
 * Key responsibilities:
 * - `startEnrichment`: pooled applications of one position → `startRun` (goal hiring, the position's questions) → application 'run-started'
 * - Per-id skips with a plain reason (over limit, not in this pool, already started, not ready, nothing to research); a skipped row
 *   that already has a run carries its `runId`
 * - The shared hourly cap (and the per-organization cap for a recruiter session) is checked once, before any run starts
 *
 * Design constraints:
 * - Authentication belongs to the caller; this module only starts what it is told to
 * - All or nothing on the cap: a request that would pass the cap starts no run at all
 * - Runs start sequentially so a Workflow failure leaves earlier applications linked and later ones still 'pooled'
 * - A row is claimed (pooled -> run-started) before its run starts, so concurrent requests never start it twice;
 *   a failed start gives the row back to the pool
 * - No Next.js imports
 */
import { loadPositionQuestions, runRoom, startRun, type StartRunEnv } from "./start-run";

export type EnrichOrigin = { via: "api" } | { via: "start"; accountId: string; organizationId: string };

export type EnrichResult =
  | { ok: false; status: 404 | 429; error: string }
  | { ok: true; started: { applicationId: string; runId: string }[]; skipped: EnrichSkip[] };

/** `runId`: the run an "already started" row already has, so the page can link it. */
export type EnrichSkip = { applicationId: string; reason: string; runId?: string };

/** Most candidates one request can start. */
export const ENRICH_MAX = 20;

type PoolApplication = { id: string; status: string; linkedin_url: string | null; cv_text: string | null; run_id?: string | null };

export async function startEnrichment(
  env: StartRunEnv,
  args: { positionId: string; applicationIds: string[]; origin: EnrichOrigin },
  now: Date,
): Promise<EnrichResult> {
  const position = await loadPositionQuestions(env.DB, args.positionId);
  if (position === null) return { ok: false, status: 404, error: "unknown position" };

  const skipped: EnrichSkip[] = [];
  const unique = [...new Set(args.applicationIds)];
  const ids = unique.slice(0, ENRICH_MAX);
  for (const applicationId of unique.slice(ENRICH_MAX)) skipped.push({ applicationId, reason: "over limit" });

  const marks = ids.map(() => "?").join(", ");
  const rows = ids.length === 0
    ? []
    : (
        await env.DB.prepare(
          `SELECT id, status, linkedin_url, cv_text, run_id FROM applications WHERE position_id = ? AND id IN (${marks})`,
        )
          .bind(args.positionId, ...ids)
          .all<PoolApplication>()
      ).results;
  const byId = new Map(rows.map((r) => [r.id, r]));

  const eligible: PoolApplication[] = [];
  for (const applicationId of ids) {
    const row = byId.get(applicationId);
    const reason = skipReason(row);
    if (row !== undefined && reason === null) eligible.push(row);
    else skipped.push({ applicationId, reason: reason ?? NOT_IN_POOL, ...(typeof row?.run_id === "string" ? { runId: row.run_id } : {}) });
  }

  const session = args.origin.via === "start" ? args.origin : null;
  if (eligible.length > 0) {
    const room = await runRoom(env.DB, session?.organizationId ?? null, now);
    const left = Math.max(0, Math.min(room.shared, room.org));
    if (eligible.length > left) return { ok: false, status: 429, error: `run cap reached: at most ${String(left)} more runs this hour` };
  }

  const started: { applicationId: string; runId: string }[] = [];
  for (const row of eligible) {
    // Claim the row first: two requests naming the same candidate (two tabs) must not start two runs.
    const claim = await env.DB.prepare("UPDATE applications SET status = 'run-started' WHERE id = ? AND status = 'pooled'").bind(row.id).run();
    if (claim.meta.changes === 0) {
      skipped.push({ applicationId: row.id, reason: "already started" });
      continue;
    }
    const { id: runId } = await startRunOrRelease(env, row, args.origin, position, now);
    await env.DB.prepare("UPDATE applications SET run_id = ? WHERE id = ?").bind(runId, row.id).run();
    started.push({ applicationId: row.id, runId });
  }
  return { ok: true, started, skipped };
}

/** startRun, giving the row back to the pool when the insert or the Workflow create throws. */
async function startRunOrRelease(
  env: StartRunEnv,
  row: PoolApplication,
  origin: EnrichOrigin,
  position: NonNullable<Awaited<ReturnType<typeof loadPositionQuestions>>>,
  now: Date,
): Promise<{ id: string }> {
  const session = origin.via === "start" ? origin : null;
  try {
    return await startRun(
      env,
      {
        goal: "hiring",
        profileUrl: row.linkedin_url ?? undefined,
        cvText: row.cv_text ?? undefined,
        via: origin.via,
        applicationId: row.id,
        position,
        accountId: session?.accountId,
        organizationId: session?.organizationId,
      },
      now,
    );
  } catch (err) {
    await env.DB.prepare("UPDATE applications SET status = 'pooled' WHERE id = ?").bind(row.id).run();
    throw err;
  }
}

const NOT_IN_POOL = "not in this position's pool";

/** Why a pool row cannot start now; null when it can. */
function skipReason(row: PoolApplication | undefined): string | null {
  if (row === undefined) return NOT_IN_POOL;
  if (row.status === "run-started") return "already started";
  if (row.status !== "pooled") return "not ready";
  if (row.linkedin_url === null && row.cv_text === null) return "no LinkedIn URL or CV text";
  return null;
}
