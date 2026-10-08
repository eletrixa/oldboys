/**
 * POST /api/runs: validate the request, insert the investigation, start the Workflow, return its id.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), src/app/api/_lib/{auth,body,run-body}, src/domain/run-status,
 *          src/workflow/start-run, bindings DB + RESEARCH_RUN, secret RUN_TOKEN
 * Tested:  body contract in src/app/api/_lib/__tests__/run-body.test.ts; insert + caps in src/workflow/__tests__/start-run.test.ts
 *
 * Key responsibilities:
 * - Bearer auth against secret RUN_TOKEN (401 when missing or wrong, 503 when the secret is unset)
 * - Body validation (StartRunBody, plans/006): profileUrl or cvText or subject + anchor; 400 on bad input
 * - Insert + Workflow create through startRun (shared with the intake funnel)
 * - Optional sourceUrl (browser extension): same page + goal within 24 h returns the earlier run (200)
 * - Shared-token cap: more than RUNS_PER_HOUR_CAP runs in the last hour → 429; START_PER_HOUR_CAP for the public form
 * - runId == Workflow instance id == investigations.id
 *
 * Design constraints:
 * - No runtime = "edge"
 * - Budget defaults come from vars RUN_BUDGET_USD / RUN_BUDGET_CALLS, never from the client
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireBearer } from "@/app/api/_lib/auth";
import { parseJsonBody } from "@/app/api/_lib/body";
import { StartRunBody } from "@/app/api/_lib/run-body";
import { dedupeSince, HOUR_MS, RUNS_PER_HOUR_CAP, START_PER_HOUR_CAP } from "@/domain/run-status";
import { runsStartedSince, startRun } from "@/workflow/start-run";

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return denied;

  const parsed = await parseJsonBody(request, StartRunBody);
  if (parsed.error) return parsed.error;

  const now = new Date();
  if (parsed.data.sourceUrl !== undefined) {
    const earlier = await env.DB.prepare(
      `SELECT id FROM investigations WHERE source_url = ? AND goal = ? AND created_at > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(parsed.data.sourceUrl, parsed.data.goal, dedupeSince(now))
      .first<{ id: string }>();
    if (earlier) return Response.json({ id: earlier.id, reused: true }, { status: 200 });
  }

  const hourAgo = new Date(now.getTime() - HOUR_MS);
  if ((await runsStartedSince(env.DB, hourAgo)) >= RUNS_PER_HOUR_CAP) {
    return Response.json({ error: "run cap reached, try again later" }, { status: 429 });
  }
  // Runs started from the public form (/api/start sets this header after adding the bearer) get a tighter cap:
  // the form has no credential of its own, so this is the only brake on anonymous spend.
  const via = request.headers.get("x-oldboys-via") === "start" ? "start" : "api";
  if (via === "start" && (await runsStartedSince(env.DB, hourAgo, "start")) >= START_PER_HOUR_CAP) {
    return Response.json({ error: "run cap reached, try again later" }, { status: 429 });
  }

  const { id } = await startRun(env, { ...parsed.data, via }, now);
  return Response.json({ id }, { status: 201 });
}
