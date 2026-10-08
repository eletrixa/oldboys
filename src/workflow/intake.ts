/**
 * The intake funnel: one job application from any connector becomes one applications row and, when it can, one run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/intake.ts
 * Deps:    src/domain/application, src/domain/cv-text, src/domain/run-status, src/workflow/start-run,
 *          bindings DB + SOURCES + RESEARCH_RUN, var INTAKE_PER_HOUR_CAP
 * Tested:  src/workflow/__tests__/intake.test.ts
 *
 * Key responsibilities:
 * - Idempotency per (source, externalId): a repeat (or an insert race) returns the first row, never a second run
 * - Store the CV file in R2 (intake/<id>/<safe name>) and extract its text when no text was sent
 * - Decide the status (unknown tag / sender not allowed / incomplete / capped / run-started) and start the run in one
 *   tail (`decideAndStart`) shared by a new delivery and the re-decision of a capped duplicate
 *
 * Design constraints:
 * - The only writer of `applications` and the only intake path to startRun (specs/intake/00-overview.md rule 1)
 * - No transaction: a failure after the INSERT propagates and leaves the row 'received'; CV text extraction, the
 *   R2 put and the intake_tags lookup are independent and run in parallel
 * - Never returns anything to a candidate; callers decide what leaves the Worker
 * - No Next.js imports (called from the Worker email handler)
 */
import {
  candidateInput,
  cvR2Key,
  decideStatus,
  IntakeInput,
  IntakeTag,
  joinNotes,
  type ApplicationStatus,
  type DecidedStatus,
} from "@/domain/application";
import type { GoalId } from "@/domain/claim";
import { extractCvText } from "@/domain/cv-text";
import { HOUR_MS, INTAKE_PER_HOUR_CAP_DEFAULT } from "@/domain/run-status";
import { runsStartedSince, startRun, type StartRunEnv } from "./start-run";

export type IntakeEnv = StartRunEnv & { SOURCES: R2Bucket; INTAKE_PER_HOUR_CAP?: string };

export type IntakeResult = {
  applicationId: string;
  status: ApplicationStatus;
  runId: string | null;
  duplicate: boolean;
  note: string | null;
};

type ExistingRow = {
  id: string;
  status: ApplicationStatus;
  run_id: string | null;
  note: string | null;
  tag: string | null;
  linkedin_url: string | null;
};

type Position = { role: string; goal: GoalId };

export async function ingestApplication(
  raw: IntakeInput,
  env: IntakeEnv,
  now: Date,
  opts: { senderAllowed?: boolean } = {},
): Promise<IntakeResult> {
  const input = IntakeInput.parse(raw);

  const existing = await findExisting(env.DB, input.source, input.externalId);
  if (existing) return existing.status === "capped" ? retryCapped(existing, env, now) : toResult(existing);

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO applications (id, source, external_id, tag, name, email, phone, cover_letter, received_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')`,
    )
      .bind(
        id,
        input.source,
        input.externalId,
        input.tag ?? null,
        input.name ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.coverLetter ?? null,
        now.toISOString(),
      )
      .run();
  } catch (err) {
    // Two deliveries of the same message raced past the SELECT; the loser reports the winner's row.
    const winner = isUniqueViolation(err) ? await findExisting(env.DB, input.source, input.externalId) : null;
    if (winner) return toResult(winner);
    throw err;
  }

  // Independent work in parallel: unpdf reads its own copy of the bytes, the R2 put the original.
  const { cv } = input;
  const cvKey = cv ? cvR2Key(id, cv.filename) : null;
  const [extracted, position] = await Promise.all([
    cv && input.cvText === undefined ? extractCvText(cv) : null,
    findPosition(env.DB, input.tag),
    cv && cvKey !== null ? env.SOURCES.put(cvKey, cv.bytes, { httpMetadata: { contentType: cv.contentType } }) : null,
  ]);
  const cvText = input.cvText ?? extracted?.text ?? undefined;

  const candidate = candidateInput({ linkedinUrl: input.linkedinUrl, cvText });
  const decision = await decideAndStart(env, { id, position, candidate, senderAllowed: opts.senderAllowed ?? true }, now);
  const note = joinNotes(decision.note, extracted?.note, ...candidate.notes, input.note);

  await env.DB.prepare(
    "UPDATE applications SET status = ?, run_id = ?, note = ?, linkedin_url = ?, cv_key = ?, cv_text = ? WHERE id = ?",
  )
    .bind(decision.status, decision.runId, note, candidate.profileUrl ?? null, cvKey, cvText ?? null, id)
    .run();

  return { applicationId: id, status: decision.status, runId: decision.runId, duplicate: false, note };
}

/**
 * The one decision tail for a new delivery and a capped retry: the hourly cap is only queried when the tag is known,
 * the sender allowed and the candidate complete; a run starts only on `run-started`. Writing the row is the caller's.
 */
async function decideAndStart(
  env: IntakeEnv,
  a: { id: string; position: Position | null; candidate: { profileUrl?: string; cvText?: string }; senderAllowed: boolean },
  now: Date,
): Promise<{ status: DecidedStatus; runId: string | null; note: string | null }> {
  const { position, candidate, senderAllowed } = a;
  const complete = candidate.profileUrl !== undefined || candidate.cvText !== undefined;
  const capped =
    position !== null && senderAllowed && complete
      ? (await runsStartedSince(env.DB, new Date(now.getTime() - HOUR_MS), "intake")) >= intakeCap(env.INTAKE_PER_HOUR_CAP)
      : false;
  const decision = decideStatus({ tagKnown: position !== null, senderAllowed, candidate, capped });
  if (decision.status !== "run-started" || position === null) return { ...decision, runId: null };
  const run = await startRun(
    env,
    { goal: position.goal, role: position.role, profileUrl: candidate.profileUrl, cvText: candidate.cvText, via: "intake", applicationId: a.id },
    now,
  );
  return { ...decision, runId: run.id };
}

async function findPosition(db: D1Database, rawTag: string | null | undefined): Promise<Position | null> {
  const tag = IntakeTag.safeParse(rawTag);
  return tag.success ? db.prepare("SELECT role, goal FROM intake_tags WHERE tag = ?").bind(tag.data).first<Position>() : null;
}

async function findExisting(db: D1Database, source: string, externalId: string): Promise<ExistingRow | null> {
  return db
    .prepare("SELECT id, status, run_id, note, tag, linkedin_url FROM applications WHERE source = ? AND external_id = ?")
    .bind(source, externalId)
    .first<ExistingRow>();
}

function toResult(row: ExistingRow): IntakeResult {
  return { applicationId: row.id, status: row.status, runId: row.run_id, duplicate: true, note: row.note };
}

/**
 * A delivery that was capped is the one duplicate worth re-deciding: the stored candidate input goes through the same
 * decision tail now, and the run starts if there is room. The new payload is ignored; the row keeps what it had, and
 * is only written when the run starts. The sender check passed when the row was capped.
 */
async function retryCapped(row: ExistingRow, env: IntakeEnv, now: Date): Promise<IntakeResult> {
  const [position, stored] = await Promise.all([
    findPosition(env.DB, row.tag),
    env.DB.prepare("SELECT cv_text FROM applications WHERE id = ?").bind(row.id).first<{ cv_text: string | null }>(),
  ]);
  const candidate = { profileUrl: row.linkedin_url ?? undefined, cvText: stored?.cv_text ?? undefined };
  const decision = await decideAndStart(env, { id: row.id, position, candidate, senderAllowed: true }, now);
  if (decision.status !== "run-started") return toResult(row);

  await env.DB.prepare("UPDATE applications SET status = ?, run_id = ?, note = ? WHERE id = ?")
    .bind(decision.status, decision.runId, decision.note, row.id)
    .run();
  return { applicationId: row.id, status: decision.status, runId: decision.runId, duplicate: true, note: decision.note };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes("UNIQUE constraint failed");
}

/** Var INTAKE_PER_HOUR_CAP; unset, blank or not a number means the default (never "no cap"). */
function intakeCap(raw: string | undefined): number {
  const n = raw === undefined || raw.trim() === "" ? Number.NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : INTAKE_PER_HOUR_CAP_DEFAULT;
}
