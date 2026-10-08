/**
 * D1 loaders for the call routes: what a call brief is built from, and the public view of calls.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/calls/load.ts
 * Deps:    zod, src/domain/{call,claim}, src/recipe/goals, src/workflow/calls, src/app/runs/[id]/call-panel, binding DB
 * Tested:  n/a (pure parts in src/app/runs/[id]/__tests__/call-panel.test.ts)
 *
 * Key responsibilities:
 * - loadCallInputs: run head (subject, goal, role, status), base + role questions, gaps, claims and the stored brief
 * - loadCallView / loadRunCallViews: calls without consent note, operator, R2 key or transcript, plus the
 *   per-question answers from the latest `call:finish` ledger row
 *
 * Design constraints:
 * - Read only; a missing or malformed brief or questions_json is null / none, never an error
 * - Never exposes a full phone number (rows carry `to_number_masked` only)
 */
import { z } from "zod";
import type { Call } from "@/domain/call";
import { Brief, Claim, type Gap, GoalId } from "@/domain/claim";
import { recipeFor } from "@/recipe/goals";
import type { Question } from "@/recipe/step";
import { type CallRow, rowToCall } from "@/workflow/calls";
import { type CallView, finishAnswers } from "@/app/runs/[id]/call-panel";

/** Role questions appended by the runner (investigations.questions_json); malformed JSON means none. */
const ExtraQuestions = z.array(z.object({ id: z.string(), text: z.string(), title: z.string().optional() }));

type ClaimRow = Omit<Claim, "supports" | "contradicts"> & {
  supports_json: string;
  contradicts_json: string;
};

export type CallInputs = {
  subject: string;
  goal: GoalId;
  role: string | null;
  status: string;
  questions: Question[];
  gaps: Gap[];
  claims: Claim[];
  brief: Brief | null;
};

function tryJson(text: string | null): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Everything a call brief is built from; null when the run does not exist. */
export async function loadCallInputs(db: D1Database, runId: string): Promise<CallInputs | null> {
  const run = await db.prepare("SELECT subject, goal, role, status, questions_json FROM investigations WHERE id = ?")
    .bind(runId)
    .first<{ subject: string; goal: string; role: string | null; status: string; questions_json: string | null }>();
  if (!run) return null;
  const goal = GoalId.parse(run.goal);
  const extra = ExtraQuestions.safeParse(tryJson(run.questions_json));

  const [gapRows, claimRows, briefRow] = await Promise.all([
    db.prepare("SELECT question_id, reason FROM gaps WHERE run_id = ?").bind(runId).all<Pick<Gap, "question_id" | "reason">>(),
    db.prepare("SELECT * FROM claims WHERE run_id = ?").bind(runId).all<ClaimRow>(),
    db.prepare("SELECT brief_json FROM briefs WHERE run_id = ?").bind(runId).first<{ brief_json: string }>(),
  ]);
  const brief = Brief.safeParse(tryJson(briefRow?.brief_json ?? null));
  return {
    subject: run.subject,
    goal,
    role: run.role,
    status: run.status,
    questions: [...recipeFor(goal).questions, ...(extra.success ? extra.data : [])],
    gaps: gapRows.results.map((g) => ({ ...g, run_id: runId })),
    claims: claimRows.results.map(({ supports_json, contradicts_json, ...rest }) =>
      Claim.parse({
        ...rest,
        supports: JSON.parse(supports_json) as unknown,
        contradicts: JSON.parse(contradicts_json) as unknown,
      }),
    ),
    brief: brief.success ? brief.data : null,
  };
}

function toView(call: Call, finishRef: string | null): CallView {
  // Never the consent note, operator, R2 key or transcript; the number is already masked.
  const { consent_note: _note, operator: _operator, result_r2_key: _key, consent_ack: _ack, ...publicCall } = call;
  return { ...publicCall, answers: finishAnswers(finishRef) };
}

const FINISH_SQL =
  "SELECT ref_json FROM ledger_entries WHERE run_id = ? AND step = 'call:finish' AND json_extract(ref_json, '$.callId') = ? ORDER BY seq DESC LIMIT 1";

/** One call with its answers; null when it does not exist. */
export async function loadCallView(db: D1Database, callId: string): Promise<CallView | null> {
  const row = await db.prepare("SELECT * FROM calls WHERE id = ?").bind(callId).first<CallRow>();
  if (!row) return null;
  const call = rowToCall(row);
  const finish = await db.prepare(FINISH_SQL).bind(call.run_id, callId).first<{ ref_json: string | null }>();
  return toView(call, finish?.ref_json ?? null);
}

/** Every call of a run except skipped ones, newest first, each with its answers. */
export async function loadRunCallViews(db: D1Database, runId: string): Promise<CallView[]> {
  const [rows, finishes] = await Promise.all([
    db.prepare("SELECT * FROM calls WHERE run_id = ? AND status != 'skipped' ORDER BY created_at DESC").bind(runId).all<CallRow>(),
    db.prepare("SELECT json_extract(ref_json, '$.callId') AS call_id, ref_json FROM ledger_entries WHERE run_id = ? AND step = 'call:finish' ORDER BY seq")
      .bind(runId)
      .all<{ call_id: string | null; ref_json: string | null }>(),
  ]);
  // Ascending seq: the latest finish row per call wins.
  const finishOf = new Map(finishes.results.flatMap((f) => (f.call_id === null ? [] : [[f.call_id, f.ref_json] as const])));
  return rows.results.map((row) => {
    const call = rowToCall(row);
    return toView(call, finishOf.get(call.id) ?? null);
  });
}
