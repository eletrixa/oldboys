/**
 * POST /api/runs: validate the request, insert the investigation, start the Workflow, return its id.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), zod, bindings DB + RESEARCH_RUN, secret RUN_TOKEN
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Bearer auth against secret RUN_TOKEN (401 when missing or wrong, 503 when the secret is unset)
 * - Body validation with Zod; 400 on bad input
 * - runId == Workflow instance id == investigations.id
 *
 * Design constraints:
 * - No runtime = "edge"
 * - Budget defaults come from vars RUN_BUDGET_USD / RUN_BUDGET_CALLS, never from the client
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { GoalId } from "@/domain/claim";

const StartRunBody = z.object({
  subject: z.string().trim().min(1).max(200),
  anchor: z.string().trim().min(1).max(200),
  goal: GoalId,
});

function isAuthorized(request: Request, token: string): boolean {
  const header = request.headers.get("Authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (presented.length === 0 || presented.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= presented.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const runToken = env.RUN_TOKEN;
  if (!runToken) {
    return Response.json({ error: "RUN_TOKEN secret is not configured" }, { status: 503 });
  }
  if (!isAuthorized(request, runToken)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const parsed = StartRunBody.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const budgetUsd = Number(env.RUN_BUDGET_USD);
  const budgetCalls = Number(env.RUN_BUDGET_CALLS);

  await env.DB.prepare(
    `INSERT INTO investigations (id, subject, anchor, goal, status, budget_usd, budget_calls, created_at)
     VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)`,
  )
    .bind(
      id,
      parsed.data.subject,
      parsed.data.anchor,
      parsed.data.goal,
      budgetUsd,
      budgetCalls,
      new Date().toISOString(),
    )
    .run();

  await env.RESEARCH_RUN.create({ id, params: { runId: id } });

  return Response.json({ id }, { status: 201 });
}
