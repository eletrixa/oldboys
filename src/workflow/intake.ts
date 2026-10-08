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
 * - Decide the status (unknown tag / sender not allowed / incomplete / capped / run-started) and start the run
 *
 * Design constraints:
 * - The only writer of `applications` and the only intake path to startRun (specs/intake/00-overview.md rule 1)
 * - One D1/R2 call per step, no transaction: a failure after the INSERT propagates and leaves the row 'received'
 * - Never returns anything to a candidate; callers decide what leaves the Worker
 * - No Next.js imports (called from the Worker email handler)
 */
import { candidateInput, cvR2Key, decideStatus, IntakeInput, IntakeTag, type ApplicationStatus } from "@/domain/application";
import type { GoalId } from "@/domain/claim";
import { extractCvText } from "@/domain/cv-text";
import { INTAKE_PER_HOUR_CAP_DEFAULT } from "@/domain/run-status";
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
  cv_text: string | null;
};

const NOTE_MAX = 1000;
const HOUR_MS = 60 * 60 * 1000;

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

  const parserNotes: string[] = [];
  let cvKey: string | null = null;
  let cvText = input.cvText;
  if (input.cv) {
    if (cvText === undefined) {
      const extracted = await extractCvText(input.cv);
      if (extracted.note !== null) parserNotes.push(extracted.note);
      cvText = extracted.text ?? undefined;
    }
    cvKey = cvR2Key(id, input.cv.filename);
    await env.SOURCES.put(cvKey, input.cv.bytes, { httpMetadata: { contentType: input.cv.contentType } });
  }

  const tag = IntakeTag.safeParse(input.tag);
  const position = tag.success
    ? await env.DB.prepare("SELECT role, goal FROM intake_tags WHERE tag = ?").bind(tag.data).first<{ role: string; goal: GoalId }>()
    : null;

  const candidate = candidateInput({ linkedinUrl: input.linkedinUrl, cvText });
  parserNotes.push(...candidate.notes);

  const senderAllowed = opts.senderAllowed ?? true;
  const complete = candidate.profileUrl !== undefined || candidate.cvText !== undefined;
  const capped =
    position !== null && senderAllowed && complete
      ? (await runsStartedSince(env.DB, new Date(now.getTime() - HOUR_MS), "intake")) >= intakeCap(env.INTAKE_PER_HOUR_CAP)
      : false;

  const decision = decideStatus({ tagKnown: position !== null, senderAllowed, candidate, capped });
  let runId: string | null = null;
  if (decision.status === "run-started" && position !== null) {
    const run = await startRun(
      env,
      { goal: position.goal, role: position.role, profileUrl: candidate.profileUrl, cvText: candidate.cvText, via: "intake", applicationId: id },
      now,
    );
    runId = run.id;
  }

  const notes = [decision.note, ...parserNotes, input.note].filter((n): n is string => n !== null && n !== undefined && n !== "");
  const note = notes.length > 0 ? notes.join("; ").slice(0, NOTE_MAX) : null;

  await env.DB.prepare(
    "UPDATE applications SET status = ?, run_id = ?, note = ?, linkedin_url = ?, cv_key = ?, cv_text = ? WHERE id = ?",
  )
    .bind(decision.status, runId, note, candidate.profileUrl ?? null, cvKey, cvText ?? null, id)
    .run();

  return { applicationId: id, status: decision.status, runId, duplicate: false, note };
}

async function findExisting(db: D1Database, source: string, externalId: string): Promise<ExistingRow | null> {
  return db
    .prepare("SELECT id, status, run_id, note, tag, linkedin_url, cv_text FROM applications WHERE source = ? AND external_id = ?")
    .bind(source, externalId)
    .first<ExistingRow>();
}

function toResult(row: ExistingRow): IntakeResult {
  return { applicationId: row.id, status: row.status, runId: row.run_id, duplicate: true, note: row.note };
}

/**
 * A delivery that was capped is the one duplicate worth re-deciding: the stored candidate input is re-checked against
 * the cap now, and the run starts if there is room. The new payload is ignored; the row keeps what it had.
 */
async function retryCapped(row: ExistingRow, env: IntakeEnv, now: Date): Promise<IntakeResult> {
  const tag = IntakeTag.safeParse(row.tag);
  const position = tag.success
    ? await env.DB.prepare("SELECT role, goal FROM intake_tags WHERE tag = ?").bind(tag.data).first<{ role: string; goal: GoalId }>()
    : null;
  const candidate = { profileUrl: row.linkedin_url ?? undefined, cvText: row.cv_text ?? undefined };
  if (position === null || (candidate.profileUrl === undefined && candidate.cvText === undefined)) return toResult(row);
  const stillCapped =
    (await runsStartedSince(env.DB, new Date(now.getTime() - HOUR_MS), "intake")) >= intakeCap(env.INTAKE_PER_HOUR_CAP);
  if (stillCapped) return toResult(row);

  const run = await startRun(env, { ...candidate, goal: position.goal, role: position.role, via: "intake", applicationId: row.id }, now);
  await env.DB.prepare("UPDATE applications SET status = ?, run_id = ?, note = ? WHERE id = ?")
    .bind("run-started", run.id, null, row.id)
    .run();
  return { applicationId: row.id, status: "run-started", runId: run.id, duplicate: true, note: null };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes("UNIQUE constraint failed");
}

/** Var INTAKE_PER_HOUR_CAP; unset, blank or not a number means the default (never "no cap"). */
function intakeCap(raw: string | undefined): number {
  const n = raw === undefined || raw.trim() === "" ? Number.NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : INTAKE_PER_HOUR_CAP_DEFAULT;
}
