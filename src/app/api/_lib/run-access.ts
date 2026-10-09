/**
 * Who may act on one run: a same-origin session user of the run's organization, or a bearer machine client.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/run-access.ts
 * Deps:    src/app/api/_lib/{same-origin,session,session-or-bearer}, src/domain/session (type)
 * Tested:  src/app/api/runs/[id]/delete/__tests__/handler.test.ts, src/app/api/runs/[id]/translate/__tests__/handler.test.ts
 *
 * Key responsibilities:
 * - authorizeRunAction: the session user (same-origin checked, browser CSRF filter) or null for a bearer caller;
 *   `denied` when neither may act (401 / 403 / 503 from requireSessionOrBearer)
 * - findRunOwner: the run's id and organization, null for an unknown run
 * - otherOrganization: a session user from another organization than the run's (a run without one is open to any user)
 *
 * Design constraints:
 * - Used by POST /api/runs/:id/delete and POST /api/runs/:id/translate so the two never drift apart
 */
import type { SessionUser } from "@/domain/session";
import { rejectCrossOrigin } from "./same-origin";
import { sessionFromRequest } from "./session";
import { requireSessionOrBearer } from "./session-or-bearer";

export async function authorizeRunAction(
  request: Request,
  env: { DB: D1Database; RUN_TOKEN?: string },
): Promise<{ user: SessionUser | null; denied: Response | null }> {
  const user = await sessionFromRequest(request, env.DB);
  if (user !== null) return { user, denied: rejectCrossOrigin(request) };
  return { user: null, denied: await requireSessionOrBearer(request, env) };
}

export type RunOwner = { id: string; organization_id: string | null };

export function findRunOwner(db: D1Database, runId: string): Promise<RunOwner | null> {
  return db.prepare("SELECT id, organization_id FROM investigations WHERE id = ?").bind(runId).first<RunOwner>();
}

export function otherOrganization(user: SessionUser | null, run: RunOwner): boolean {
  return user !== null && run.organization_id !== null && run.organization_id !== user.organizationId;
}
