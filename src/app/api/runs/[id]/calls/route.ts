/**
 * POST /api/runs/:id/calls: draft a Verification Call brief from a run's gaps and weak claims.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/calls/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), zod, src/domain/call-brief, src/workflow/calls, bindings DB
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Bearer auth; load the run, its gaps and claims; build the deterministic brief
 * - Insert a calls row in status 'drafted' (nothing is dialed here)
 *
 * Design constraints:
 * - No runtime = "edge"; no phone number is accepted or stored at this stage
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { requireBearer } from "@/app/api/_lib/auth";
import { buildCallBrief } from "@/domain/call-brief";
import { Claim, GoalId, type Gap } from "@/domain/claim";
import { recipeFor } from "@/recipe/goals";
import { selectCallProvider } from "@/workflow/calls";

const DraftBody = z.object({ language: z.string().min(2).max(5).optional() });

type ClaimRow = Omit<Claim, "supports" | "contradicts"> & {
  supports_json: string;
  contradicts_json: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { env } = getCloudflareContext();
  const denied = requireBearer(request, env.RUN_TOKEN);
  if (denied) return denied;

  const { id: runId } = await params;
  const text = await request.text();
  let raw: unknown = {};
  if (text.trim().length > 0) {
    try {
      raw = JSON.parse(text);
    } catch {
      return Response.json({ error: "body must be JSON" }, { status: 400 });
    }
  }
  const parsed = DraftBody.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const run = await env.DB.prepare("SELECT subject, goal, status FROM investigations WHERE id = ?")
    .bind(runId)
    .first<{ subject: string; goal: string; status: string }>();
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  if (run.status === "queued") {
    return Response.json({ error: "run has not started yet" }, { status: 409 });
  }
  const goal = GoalId.parse(run.goal);

  const gapRows = await env.DB.prepare("SELECT question_id, reason FROM gaps WHERE run_id = ?")
    .bind(runId)
    .all<Pick<Gap, "question_id" | "reason">>();
  const gaps: Gap[] = gapRows.results.map((g) => ({ ...g, run_id: runId }));
  const claimRows = await env.DB.prepare("SELECT * FROM claims WHERE run_id = ?")
    .bind(runId)
    .all<ClaimRow>();
  const claims = claimRows.results.map(({ supports_json, contradicts_json, ...rest }) =>
    Claim.parse({
      ...rest,
      supports: JSON.parse(supports_json) as unknown,
      contradicts: JSON.parse(contradicts_json) as unknown,
    }),
  );

  const brief = buildCallBrief({
    goal,
    subject: run.subject,
    questions: recipeFor(goal).questions,
    gaps,
    claims,
    language: parsed.data.language,
  });

  const callId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO calls (id, run_id, status, provider, consent_ack, brief_json, cost_usd, created_at)
     VALUES (?, ?, 'drafted', ?, 0, ?, 0, ?)`,
  )
    .bind(callId, runId, selectCallProvider(env).provider, JSON.stringify(brief), new Date().toISOString())
    .run();

  return Response.json({ id: callId, brief }, { status: 201 });
}
