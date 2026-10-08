/**
 * POST /api/runs: validate the request, insert the investigation, start the Workflow, return its id.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), zod, src/app/api/_lib/auth, bindings DB + RESEARCH_RUN, secret RUN_TOKEN
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Bearer auth against secret RUN_TOKEN (401 when missing or wrong, 503 when the secret is unset)
 * - Body validation with Zod; 400 on bad input
 * - Optional sourceUrl (browser extension): same page + goal within 24 h returns the earlier run (200)
 * - Shared-token cap: more than RUNS_PER_HOUR_CAP runs in the last hour → 429; START_PER_HOUR_CAP for the public form
 * - runId == Workflow instance id == investigations.id
 *
 * Design constraints:
 * - No runtime = "edge"
 * - Budget defaults come from vars RUN_BUDGET_USD / RUN_BUDGET_CALLS, never from the client
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { requireBearer } from "@/app/api/_lib/auth";
import { parseJsonBody } from "@/app/api/_lib/body";
import { GoalId } from "@/domain/claim";
import { dedupeSince, RUNS_PER_HOUR_CAP, START_PER_HOUR_CAP } from "@/domain/run-status";

const StartRunBody = z.object({
  subject: z.string().trim().min(1).max(200),
  anchor: z.string().trim().min(1).max(200),
  goal: GoalId,
  sourceUrl: z.url().max(500).optional(),
  /** Free-text role the manager is hiring for; drives the must-have questions (hiring goal). */
  role: z.string().trim().min(1).max(300).optional(),
});

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

  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM investigations WHERE created_at > ?")
    .bind(hourAgo)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= RUNS_PER_HOUR_CAP) {
    return Response.json({ error: "run cap reached, try again later" }, { status: 429 });
  }
  // Runs started from the public form (/api/start sets this header after adding the bearer) get a tighter cap:
  // the form has no credential of its own, so this is the only brake on anonymous spend.
  const via = request.headers.get("x-oldboys-via") === "start" ? "start" : "api";
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
    `INSERT INTO investigations (id, subject, anchor, goal, status, budget_usd, budget_calls, created_at, source_url, role, via)
     VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      parsed.data.subject,
      parsed.data.anchor,
      parsed.data.goal,
      budgetUsd,
      budgetCalls,
      now.toISOString(),
      parsed.data.sourceUrl ?? null,
      parsed.data.role ?? null,
      via,
    )
    .run();

  await env.RESEARCH_RUN.create({ id, params: { runId: id } });

  return Response.json({ id }, { status: 201 });
}
