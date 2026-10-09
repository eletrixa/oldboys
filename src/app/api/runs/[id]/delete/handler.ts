/**
 * POST /api/runs/:id/delete logic: delete a run's data now, on rejection or on the candidate's request (idea #17).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/delete/handler.ts
 * Deps:    src/app/api/_lib/{run-access,body}, src/domain/deletion, src/workflow/{purge,stop-run}, bindings DB + SOURCES + RESEARCH_RUN + VERIFY_CALL
 * Tested:  src/app/api/runs/[id]/delete/__tests__/handler.test.ts
 *
 * Key responsibilities:
 * - Auth: a session user must pass the same-origin check (browser CSRF filter); without a session requireSessionOrBearer
 *   decides (bearer for scripts, 401 otherwise)
 * - Body `{ reason }` (Zod, 400); unknown run 404 (also on a second call); a session user from another organization 403
 * - A live phone call (callInProgress) is 409 "a phone call is in progress, try again when it ends": nothing is stopped or deleted
 * - Terminates the research Workflow and every approved call's Workflow (stopRunWork); if one cannot be stopped, 502 and nothing is deleted
 * - deleteRunData (the same delete the 7-day purge runs), then the receipt `{ run_id, deleted_at, reason, counts }`
 *
 * Design constraints:
 * - The receipt carries no personal data (no name, URLs or CV text) and nothing is stored about the deletion (no migration)
 * - Takes bindings as parameters so tests run under plain Node; no Next.js imports; every response is no-store
 * - Never calls ElevenLabs or Twilio; provider-side copies follow the provider's retention (PROVIDER_RETENTION)
 */
import { parseJsonBody } from "@/app/api/_lib/body";
import { authorizeRunAction, findRunOwner, otherOrganization } from "@/app/api/_lib/run-access";
import { callInProgress, callsWithWorkflow, DeleteBody, type CallRow, type DeletionReceipt } from "@/domain/deletion";
import { deleteRunData } from "@/workflow/purge";
import { stopRunWork, type RunWorkflows } from "@/workflow/stop-run";

export type DeleteRunEnv = RunWorkflows & { DB: D1Database; SOURCES: R2Bucket; RUN_TOKEN?: string };
export type DeleteRunDeps = { now: () => Date; deleteRun: typeof deleteRunData };

const DEFAULT_DEPS: DeleteRunDeps = { now: () => new Date(), deleteRun: deleteRunData };

const json = (body: unknown, status = 200): Response => Response.json(body, { status });

export async function deleteRunRoute(request: Request, env: DeleteRunEnv, runId: string, deps: DeleteRunDeps = DEFAULT_DEPS): Promise<Response> {
  const res = await handle(request, env, runId, deps);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function handle(request: Request, env: DeleteRunEnv, runId: string, deps: DeleteRunDeps): Promise<Response> {
  const { user, denied } = await authorizeRunAction(request, env);
  if (denied !== null) return denied;
  const body = await parseJsonBody(request, DeleteBody);
  if (body.error) return body.error;

  const run = await findRunOwner(env.DB, runId);
  if (!run) return json({ error: "run not found" }, 404);
  if (otherOrganization(user, run)) return json({ error: "this run belongs to another organization" }, 403);

  const now = deps.now();
  const { results: calls } = await env.DB.prepare("SELECT id, status, provider, approved_at FROM calls WHERE run_id = ?").bind(runId).all<CallRow>();
  if (callInProgress(calls, now)) return json({ error: "a phone call is in progress, try again when it ends" }, 409);

  try {
    await stopRunWork(env, runId, callsWithWorkflow(calls));
  } catch {
    return json({ error: "the research could not be stopped; nothing was deleted, try again" }, 502);
  }

  const counts = await deps.deleteRun(env.DB, env.SOURCES, runId);
  const receipt: DeletionReceipt = { run_id: runId, deleted_at: now.toISOString(), reason: body.data.reason, counts };
  return json(receipt);
}
