/**
 * /api/runs/:id/calls: draft a Verification Call (POST) or show the proposal and the run's calls (GET).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/calls/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), src/app/api/_lib/session-or-bearer, zod, src/domain/call-brief, src/workflow/calls, ./load, bindings DB
 * Tested:  n/a (brief building in src/domain/__tests__/call-brief.test.ts)
 *
 * Key responsibilities:
 * - POST: session or bearer auth (requireSessionOrBearer); `{language?, questions?}`. With `questions` (operator-edited) the brief is built from
 *   them (an invalid one is 400 `{error, index}`); without them from the stored brief, gaps and weak claims.
 *   Inserts a calls row in status 'drafted' (nothing is dialed here)
 * - GET: `{provider, max, used, proposal, calls}`; the proposal is computed, never stored
 *
 * Design constraints:
 * - No runtime = "edge"; no phone number is accepted or stored at this stage
 * - POST without `questions` behaves as before (scripts/call-smoke.mjs)
 * - GET has no auth, like /state and GET /api/calls/:id (the run id is an unguessable UUID); it never
 *   exposes consent notes, operators or full numbers
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { parseJsonBody } from "@/app/api/_lib/body";
import { requireSessionOrBearer } from "@/app/api/_lib/session-or-bearer";
import type { RunCalls } from "@/app/runs/[id]/call-panel";
import type { CallBrief } from "@/domain/call";
import { briefFromHrQuestions, buildCallBrief } from "@/domain/call-brief";
import { selectCallProvider } from "@/workflow/calls";
import { type CallInputs, loadCallInputs, loadRunCallViews } from "./load";

const DraftBody = z.object({
  language: z.string().min(2).max(5).optional(),
  questions: z
    .array(z.object({ question_id: z.string().max(64).optional(), text: z.string().max(2000), why: z.string().max(500).optional() }))
    .max(20)
    .optional(),
});

function proposal(inputs: CallInputs, language?: string): CallBrief {
  return buildCallBrief({ ...inputs, language });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { env } = getCloudflareContext();
  const { id: runId } = await params;
  const inputs = await loadCallInputs(env.DB, runId);
  if (!inputs) return Response.json({ error: "run not found" }, { status: 404 });
  const calls = await loadRunCallViews(env.DB, runId);
  const body: RunCalls = {
    provider: selectCallProvider(env),
    max: Number(env.RUN_CALL_MAX) || 2,
    used: calls.filter((c) => c.status !== "drafted").length,
    proposal: proposal(inputs),
    calls,
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { env } = getCloudflareContext();
  const denied = await requireSessionOrBearer(request, env);
  if (denied) return denied;

  const { id: runId } = await params;
  const body = await parseJsonBody(request, DraftBody, { emptyOk: true });
  if (body.error) return body.error;

  const inputs = await loadCallInputs(env.DB, runId);
  if (!inputs) return Response.json({ error: "run not found" }, { status: 404 });
  if (inputs.status === "queued") {
    return Response.json({ error: "run has not started yet" }, { status: 409 });
  }

  let brief: CallBrief;
  if (body.data.questions === undefined) {
    brief = proposal(inputs, body.data.language);
  } else {
    const hr = briefFromHrQuestions({ ...inputs, questions: body.data.questions, language: body.data.language });
    if (hr.error !== null) return Response.json({ error: hr.error, index: hr.index }, { status: 400 });
    brief = hr.brief;
  }

  const callId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO calls (id, run_id, status, provider, consent_ack, brief_json, cost_usd, created_at)
     VALUES (?, ?, 'drafted', ?, 0, ?, 0, ?)`,
  )
    .bind(callId, runId, selectCallProvider(env), JSON.stringify(brief), new Date().toISOString())
    .run();

  return Response.json({ id: callId, brief }, { status: 201 });
}
