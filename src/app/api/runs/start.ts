/**
 * Insert a queued investigation, optionally from a stored position (specs/positions-start).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/start.ts
 * Deps:    src/app/api/_lib/run-body (type), src/domain/position, binding DB (D1)
 * Tested:  src/app/api/runs/__tests__/start-from-position.test.ts
 *
 * Key responsibilities:
 * - insertRun: without positionId the INSERT is exactly the pre-position one (no position_id column, so an un-migrated database keeps working)
 * - With positionId: load id, title, must_haves_json; role = position title (a body role is ignored) and
 *   questions_json = JSON.stringify(mustHavesToQuestions(position)), copied at run start
 * - Unknown position, or must-haves that no longer parse: { ok: false, status: 404 } and no INSERT
 *
 * Design constraints:
 * - questions_json is never null when a position is given, so the Workflow skips role_questions
 * - An expired but not yet purged position is still usable (no expires_at check)
 * - No rate limiting or Workflow start here; route.ts owns both
 */
import type { StartRunBody } from "@/app/api/_lib/run-body";
import { MustHaves, mustHavesToQuestions } from "@/domain/position";

export type InsertRunInput = {
  id: string;
  body: StartRunBody;
  now: Date;
  budgetUsd: number;
  budgetCalls: number;
  via: "start" | "api";
};

export type InsertRunResult = { ok: true } | { ok: false; status: 404; error: string };

const UNKNOWN_POSITION: InsertRunResult = { ok: false, status: 404, error: "unknown position" };

async function loadQuestions(db: Pick<D1Database, "prepare">, positionId: string): Promise<{ title: string; questionsJson: string } | null> {
  const row = await db
    .prepare("SELECT id, title, must_haves_json FROM positions WHERE id = ?")
    .bind(positionId)
    .first<{ id: string; title: string; must_haves_json: string }>();
  if (!row) return null;
  try {
    const mustHaves = MustHaves.safeParse(JSON.parse(row.must_haves_json));
    return mustHaves.success ? { title: row.title, questionsJson: JSON.stringify(mustHavesToQuestions({ must_haves: mustHaves.data })) } : null;
  } catch {
    return null;
  }
}

export async function insertRun(db: Pick<D1Database, "prepare">, input: InsertRunInput): Promise<InsertRunResult> {
  const { id, body, now, budgetUsd, budgetCalls, via } = input;
  const position = body.positionId === undefined ? undefined : await loadQuestions(db, body.positionId);
  if (position === null) return UNKNOWN_POSITION;

  const common = [id, body.subject ?? "", body.anchor ?? "", body.goal, budgetUsd, budgetCalls, now.toISOString(), body.sourceUrl ?? null];
  const tail = [via, body.profileUrl ?? null, body.cvText ?? null];
  if (position === undefined) {
    await db
      .prepare(
        `INSERT INTO investigations (id, subject, anchor, goal, status, budget_usd, budget_calls, created_at, source_url, role, via, profile_url, cv_text)
         VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(...common, body.role ?? null, ...tail)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO investigations (id, subject, anchor, goal, status, budget_usd, budget_calls, created_at, source_url, role, via, profile_url, cv_text, position_id, questions_json)
         VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(...common, position.title, ...tail, body.positionId, position.questionsJson)
      .run();
  }
  return { ok: true };
}
