/**
 * POST /api/runs/:id/answer: deliver the user's lineup pick to the paused Workflow instance.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/answer/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), zod, binding RESEARCH_RUN
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Validate {decisions:[{id,decision}]} (or legacy {candidateId}); send the 'lineup-answer' event the resolve step waits for
 *
 * Design constraints:
 * - No runtime = "edge"; the event type string must match src/workflow/research-run.ts
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import type { LineupAnswer } from "@/workflow/research-run";

const Decision = z.object({ id: z.string().trim().min(1), decision: z.enum(["merge", "possibly-same-as", "rejected"]) });
/** New shape: explicit decisions per candidate. Legacy `{candidateId}` still accepted (= merge that one). */
const AnswerBody = z.union([
  z.object({ decisions: z.array(Decision).min(1) }),
  z.object({ candidateId: z.string().trim().min(1) }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const parsed = AnswerBody.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  let instance: WorkflowInstance;
  try {
    instance = await env.RESEARCH_RUN.get(id);
  } catch {
    return Response.json({ error: "run not found" }, { status: 404 });
  }
  const payload: LineupAnswer =
    "decisions" in parsed.data
      ? { decisions: parsed.data.decisions }
      : { decisions: [{ id: parsed.data.candidateId, decision: "merge" }] };
  await instance.sendEvent({ type: "lineup-answer", payload });
  return Response.json({ ok: true, id });
}
