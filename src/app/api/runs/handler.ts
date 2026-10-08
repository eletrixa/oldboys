/**
 * createRun: validate a run request, insert the investigation, start the Workflow, return its id.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/handler.ts
 * Deps:    src/app/api/_lib/{body,run-body}, src/domain/run-status, bindings DB + RESEARCH_RUN
 * Tested:  src/app/api/runs/__tests__/handler.test.ts; body contract in src/app/api/_lib/__tests__/run-body.test.ts
 *
 * Key responsibilities:
 * - Body validation (StartRunBody, plans/006): profileUrl or cvText or subject + anchor; 400 on bad input
 * - Profile-first runs insert subject "" / anchor ""; the Workflow's seed_profile step fills them
 * - Optional sourceUrl (browser extension): same page + goal within 24 h returns the earlier run (200)
 * - Shared cap: more than RUNS_PER_HOUR_CAP runs in the last hour → 429; START_PER_HOUR_CAP more for via = start
 * - Session runs (via = start) store account_id and organization_id; bearer runs keep NULL
 * - runId == Workflow instance id == investigations.id
 *
 * Design constraints:
 * - Caller authenticates (bearer or session); this module never reads credentials or the x-oldboys-via header
 * - Budget defaults come from vars RUN_BUDGET_USD / RUN_BUDGET_CALLS, never from the client
 */
import { parseJsonBody } from "@/app/api/_lib/body";
import { StartRunBody } from "@/app/api/_lib/run-body";
import { dedupeSince, RUNS_PER_HOUR_CAP, START_PER_HOUR_CAP } from "@/domain/run-status";

export type RunsEnv = {
  DB: D1Database;
  RESEARCH_RUN: Pick<CloudflareEnv["RESEARCH_RUN"], "create">;
  RUN_BUDGET_USD: string;
  RUN_BUDGET_CALLS: string;
};

export type RunOrigin = { via: "api" } | { via: "start"; accountId: string; organizationId: string };

export async function createRun(
  request: Request,
  env: RunsEnv,
  origin: RunOrigin,
  now: Date = new Date(),
): Promise<Response> {
  const parsed = await parseJsonBody(request, StartRunBody);
  if (parsed.error) return parsed.error;

  if (parsed.data.sourceUrl !== undefined) {
    const earlier = await env.DB.prepare(
      `SELECT id FROM investigations WHERE source_url = ? AND goal = ? AND created_at > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(parsed.data.sourceUrl, parsed.data.goal, dedupeSince(now))
      .first<{ id: string }>();
    if (earlier) return Response.json({ id: earlier.id, reused: true }, { status: 200 });
  }

  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM investigations WHERE created_at > ?")
    .bind(hourAgo)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= RUNS_PER_HOUR_CAP) {
    return Response.json({ error: "run cap reached, try again later" }, { status: 429 });
  }
  // Session runs (the start form) get a tighter cap on top of the shared one: the brake on spend per hour.
  const via = origin.via;
  if (via === "start") {
    const anon = await env.DB.prepare("SELECT COUNT(*) AS n FROM investigations WHERE via = 'start' AND created_at > ?")
      .bind(hourAgo)
      .first<{ n: number }>();
    if ((anon?.n ?? 0) >= START_PER_HOUR_CAP) {
      return Response.json({ error: "run cap reached, try again later" }, { status: 429 });
    }
  }

  const id = crypto.randomUUID();
  const budgetUsd = Number(env.RUN_BUDGET_USD);
  const budgetCalls = Number(env.RUN_BUDGET_CALLS);

  await env.DB.prepare(
    `INSERT INTO investigations (id, subject, anchor, goal, status, budget_usd, budget_calls, created_at, source_url, role, via, profile_url, cv_text, account_id, organization_id)
     VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      parsed.data.subject ?? "",
      parsed.data.anchor ?? "",
      parsed.data.goal,
      budgetUsd,
      budgetCalls,
      now.toISOString(),
      parsed.data.sourceUrl ?? null,
      parsed.data.role ?? null,
      via,
      parsed.data.profileUrl ?? null,
      parsed.data.cvText ?? null,
      origin.via === "start" ? origin.accountId : null,
      origin.via === "start" ? origin.organizationId : null,
    )
    .run();

  await env.RESEARCH_RUN.create({ id, params: { runId: id } });

  return Response.json({ id }, { status: 201 });
}
