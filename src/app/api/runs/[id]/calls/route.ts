/**
 * POST /api/runs/:id/calls: draft a Verification Call brief from a run's gaps and weak claims.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/calls/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), zod, src/domain/call-brief, src/workflow/calls, bindings DB
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Bearer auth; load the run, its base + role questions, gaps and claims; build the deterministic brief
 * - Insert a calls row in status 'drafted' (nothing is dialed here)
 *
 * Design constraints:
 * - No runtime = "edge"; no phone number is accepted or stored at this stage
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { requireBearer } from "@/app/api/_lib/auth";
import { parseJsonBody } from "@/app/api/_lib/body";
import { buildCallBrief } from "@/domain/call-brief";
import { Claim, GoalId, type Gap } from "@/domain/claim";
import { recipeFor } from "@/recipe/goals";
import { selectCallProvider } from "@/workflow/calls";

const DraftBody = z.object({ language: z.string().min(2).max(5).optional() });
/** Role questions appended by the runner (investigations.questions_json); malformed JSON means none. */
const ExtraQuestions = z.array(z.object({ id: z.string(), text: z.string(), title: z.string().optional() }));

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
  const body = await parseJsonBody(request, DraftBody, { emptyOk: true });
  if (body.error) return body.error;

  const run = await env.DB.prepare("SELECT subject, goal, status, questions_json FROM investigations WHERE id = ?")
    .bind(runId)
    .first<{ subject: string; goal: string; status: string; questions_json: string | null }>();
  if (!run) return Response.json({ error: "run not found" }, { status: 404 });
  if (run.status === "queued") {
    return Response.json({ error: "run has not started yet" }, { status: 409 });
  }
  const goal = GoalId.parse(run.goal);
  const extra = ExtraQuestions.safeParse(tryJson(run.questions_json));

  const [gapRows, claimRows] = await Promise.all([
    env.DB.prepare("SELECT question_id, reason FROM gaps WHERE run_id = ?").bind(runId).all<Pick<Gap, "question_id" | "reason">>(),
    env.DB.prepare("SELECT * FROM claims WHERE run_id = ?").bind(runId).all<ClaimRow>(),
  ]);
  const gaps: Gap[] = gapRows.results.map((g) => ({ ...g, run_id: runId }));
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
    questions: [...recipeFor(goal).questions, ...(extra.success ? extra.data : [])],
    gaps,
    claims,
    language: body.data.language,
  });

  const callId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO calls (id, run_id, status, provider, consent_ack, brief_json, cost_usd, created_at)
     VALUES (?, ?, 'drafted', ?, 0, ?, 0, ?)`,
  )
    .bind(callId, runId, selectCallProvider(env), JSON.stringify(brief), new Date().toISOString())
    .run();

  return Response.json({ id: callId, brief }, { status: 201 });
}

function tryJson(text: string | null): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
