/**
 * Start one research run: insert the investigation row and create its Workflow instance (shared by POST /api/runs and intake).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/start-run.ts
 * Deps:    src/domain/claim (GoalId), src/domain/position (parseMustHaves, mustHavesToQuestions), bindings DB + RESEARCH_RUN, vars RUN_BUDGET_USD / RUN_BUDGET_CALLS
 * Tested:  src/workflow/__tests__/start-run.test.ts
 *
 * Key responsibilities:
 * - `startRun`: one INSERT into investigations (status 'queued', budget from vars) then RESEARCH_RUN.create
 * - `runsStartedSince`: run count since a time, optionally per `via`, for the hourly spend caps
 * - `loadPositionQuestions`: a stored position's title and its must-haves as the run's questions_json (specs/positions-start)
 *
 * Design constraints:
 * - runId == Workflow instance id == investigations.id
 * - Profile-first runs insert subject "" / anchor ""; the Workflow's seed_profile step fills them
 * - With a position: role = position title (an input role is ignored) and questions_json is never null, so the
 *   Workflow skips role_questions; without one, position_id and questions_json are bound NULL
 * - account_id / organization_id are set only for runs started by a logged-in recruiter (plans/009), NULL otherwise
 * - Caps, auth and dedup belong to the callers; this module only starts what it is told to
 * - No Next.js imports (called from the Worker email handler too)
 */
import type { GoalId } from "@/domain/claim";
import { mustHavesToQuestions, parseMustHaves } from "@/domain/position";

export type StartRunEnv = {
  DB: D1Database;
  RESEARCH_RUN: Workflow<{ runId: string }>;
  RUN_BUDGET_USD: string;
  RUN_BUDGET_CALLS: string;
};

export type StartRunInput = {
  goal: GoalId;
  role?: string;
  profileUrl?: string;
  cvText?: string;
  subject?: string;
  anchor?: string;
  sourceUrl?: string;
  via: "api" | "start" | "intake";
  applicationId?: string;
  position?: PositionQuestions;
  /** Set for runs started by a logged-in recruiter (via = start); NULL for bearer, extension and intake runs. */
  accountId?: string;
  organizationId?: string;
};

export type PositionQuestions = { id: string; title: string; questionsJson: string };

export async function startRun(env: StartRunEnv, input: StartRunInput, now: Date): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO investigations (id, subject, anchor, goal, status, budget_usd, budget_calls, created_at, source_url, role, via, profile_url, cv_text, application_id, account_id, organization_id, position_id, questions_json)
     VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.subject ?? "",
      input.anchor ?? "",
      input.goal,
      Number(env.RUN_BUDGET_USD),
      Number(env.RUN_BUDGET_CALLS),
      now.toISOString(),
      input.sourceUrl ?? null,
      input.position?.title ?? input.role ?? null,
      input.via,
      input.profileUrl ?? null,
      input.cvText ?? null,
      input.applicationId ?? null,
      input.accountId ?? null,
      input.organizationId ?? null,
      input.position?.id ?? null,
      input.position?.questionsJson ?? null,
    )
    .run();
  await env.RESEARCH_RUN.create({ id, params: { runId: id } });
  return { id };
}

export async function runsStartedSince(db: D1Database, since: Date, via?: string): Promise<number> {
  const base = "SELECT COUNT(*) AS n FROM investigations WHERE created_at > ?";
  const row = await (via === undefined
    ? db.prepare(base).bind(since.toISOString())
    : db.prepare(`${base} AND via = ?`).bind(since.toISOString(), via)
  ).first<{ n: number }>();
  return row?.n ?? 0;
}

/** Null when the position is unknown or its must-haves no longer parse (the caller answers 404, nothing is inserted). */
export async function loadPositionQuestions(db: Pick<D1Database, "prepare">, positionId: string): Promise<PositionQuestions | null> {
  const row = await db
    .prepare("SELECT title, must_haves_json FROM positions WHERE id = ?")
    .bind(positionId)
    .first<{ title: string; must_haves_json: string }>();
  const mustHaves = row ? parseMustHaves(row.must_haves_json) : null;
  if (!row || mustHaves === null) return null;
  return { id: positionId, title: row.title, questionsJson: JSON.stringify(mustHavesToQuestions({ must_haves: mustHaves })) };
}
