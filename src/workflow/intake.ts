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
 * - Store the CV file in R2 (intake/<id>/<safe name>) when the delivery can become a run, and extract its text
 * - Decide the status (unknown tag / sender not allowed / incomplete / pooled / capped / run-started) and start the run in one
 *   tail (`decideAndStart`) shared by a new delivery, the re-decision of a capped duplicate and the resume of a row
 *   that a failed delivery left at 'received'
 * - `retryCappedApplications`: the cron's queue pass, so a capped application starts its run once the hour has room
 *   without anyone delivering it again
 *
 * - Plans/010: a tag bound to a position, and every manual add, pools the row (status 'pooled', position_id set, no run);
 *   a run starts later from src/workflow/enrich.ts. A tag without a position keeps the auto-start path
 *
 * Design constraints:
 * - The only writer of `applications` and the only intake path to startRun (specs/intake/00-overview.md rule 1)
 * - No transaction: a failure after the INSERT propagates and leaves the row 'received' marked DELIVERY_FAILED_NOTE;
 *   the next delivery of the same message claims the mark and resumes it at once (a row without the mark may still be
 *   in flight and is resumed only once older than STALE_RECEIVED_MS). A resume stores the CV like a first delivery
 *   and links a run the failed attempt had already inserted (creating its Workflow instance if that was what threw)
 * - Never returns anything to a candidate; callers decide what leaves the Worker
 * - No Next.js imports (called from the Worker email handler)
 */
import {
  candidateInput,
  CAPPED_NOTE,
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

/** A row still 'received' after this long is not in flight: the delivery that inserted it died without a trace. */
export const STALE_RECEIVED_MS = 5 * 60_000;

/** The note a delivery leaves on its row when it threw after the INSERT; the next delivery resumes such a row at once. */
export const DELIVERY_FAILED_NOTE = "delivery failed after it was stored; the next delivery resumes it";

/** Capped rows the cron re-decides per tick, oldest first. */
const QUEUE_BATCH = 20;

const EXISTING_COLUMNS = "id, status, run_id, note, tag, linkedin_url, received_at";

type ExistingRow = {
  id: string;
  status: ApplicationStatus;
  run_id: string | null;
  note: string | null;
  tag: string | null;
  linkedin_url: string | null;
  received_at: string;
};

/** Where an application lands: the role and goal a run would get, and the position whose pool it joins (null = auto-start). */
type Position = { role: string; goal: GoalId; positionId: string | null };

export async function ingestApplication(
  raw: IntakeInput,
  env: IntakeEnv,
  now: Date,
  opts: { senderAllowed?: boolean } = {},
): Promise<IntakeResult> {
  const input = IntakeInput.parse(raw);
  const senderAllowed = opts.senderAllowed ?? true;

  const existing = await findExisting(env.DB, input.source, input.externalId);
  if (existing) {
    if (existing.status === "capped") return (await retryCapped(existing, env, now)).result;
    if (existing.status === "received" && (await resumable(env.DB, existing, now))) {
      return markOnFailure(env.DB, existing.id, () => resumeReceived(existing.id, input, env, now, senderAllowed));
    }
    return toResult(existing);
  }

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

  return markOnFailure(env.DB, id, () => decideAndWrite(id, input, env, now, senderAllowed, false));
}

/**
 * The queue half of the hourly cap: re-decide the oldest `capped` rows (the cron calls this) and start their runs while
 * the hour has room. Stops at the first row that is still capped; a row whose tag has gone since is skipped, not
 * blocking the rest. Returns how many runs it started.
 */
export async function retryCappedApplications(env: IntakeEnv, now: Date): Promise<number> {
  const { results } = await env.DB.prepare(`SELECT ${EXISTING_COLUMNS} FROM applications WHERE status = 'capped' ORDER BY received_at LIMIT ?`)
    .bind(QUEUE_BATCH)
    .all<ExistingRow>();
  let started = 0;
  for (const row of results) {
    const { decided } = await retryCapped(row, env, now);
    if (decided === "capped") break;
    if (decided === "run-started") started += 1;
  }
  return started;
}

/** Run a delivery's work after its INSERT; when it throws, mark the row so the next delivery resumes it at once. */
async function markOnFailure(db: D1Database, id: string, work: () => Promise<IntakeResult>): Promise<IntakeResult> {
  try {
    return await work();
  } catch (err) {
    // Best effort: when D1 itself is down the mark fails too, and the stale window still resumes the row later.
    await db
      .prepare("UPDATE applications SET note = ? WHERE id = ?")
      .bind(DELIVERY_FAILED_NOTE, id)
      .run()
      .catch(() => undefined);
    throw err;
  }
}

/**
 * Whether a duplicate delivery may resume a 'received' row: a row marked failed is claimed atomically (two retries
 * racing get one winner; the loser answers like an in-flight duplicate), an unmarked one only after the stale window.
 */
async function resumable(db: D1Database, row: ExistingRow, now: Date): Promise<boolean> {
  if (row.note !== DELIVERY_FAILED_NOTE) return isStale(row, now);
  const claim = await db
    .prepare("UPDATE applications SET note = NULL WHERE id = ? AND note = ?")
    .bind(row.id, DELIVERY_FAILED_NOTE)
    .run();
  return claim.meta.changes === 1;
}

/**
 * Everything after the INSERT: CV text, tag lookup, the file put, the decision, the row update. `linkedRunId` is a run
 * a failed attempt had already inserted: it is linked as `run-started` and no second run starts.
 */
async function decideAndWrite(
  id: string,
  input: IntakeInput,
  env: IntakeEnv,
  now: Date,
  senderAllowed: boolean,
  duplicate: boolean,
  linkedRunId: string | null = null,
): Promise<IntakeResult> {
  // Independent work in parallel: unpdf reads its own copy of the bytes.
  const { cv } = input;
  const [extracted, position] = await Promise.all([
    cv && input.cvText === undefined ? extractCvText(cv) : null,
    findPosition(env.DB, input),
  ]);
  const cvText = input.cvText ?? extracted?.text ?? undefined;

  // The file is kept only for a delivery that can become a run: a stranger's attachment costs no R2 object.
  const cvKey = cv && position !== null && senderAllowed ? cvR2Key(id, cv.filename) : null;
  if (cv && cvKey !== null) await env.SOURCES.put(cvKey, cv.bytes, { httpMetadata: { contentType: cv.contentType } });

  const candidate = candidateInput({ linkedinUrl: input.linkedinUrl, cvText });
  const decision =
    linkedRunId === null
      ? await decideAndStart(env, { id, position, candidate, senderAllowed }, now)
      : { status: "run-started" as const, runId: linkedRunId, note: null as string | null };
  if (decision.status === "unmatched" && position === null && input.source === "manual") decision.note = "unknown position";
  const note = joinNotes(decision.note, extracted?.note, ...candidate.notes, input.note);

  await env.DB.prepare(
    "UPDATE applications SET status = ?, run_id = ?, note = ?, linkedin_url = ?, cv_key = ?, cv_text = ?, position_id = ? WHERE id = ?",
  )
    .bind(decision.status, decision.runId, note, candidate.profileUrl ?? null, cvKey, cvText ?? null, position?.positionId ?? null, id)
    .run();

  return { applicationId: id, status: decision.status, runId: decision.runId, duplicate, note };
}

/**
 * The one decision tail for a new delivery and a capped retry: the hourly cap is only queried when the tag is known,
 * the sender allowed and the candidate complete; a run starts only on `run-started`. Writing the row is the caller's.
 */
async function decideAndStart(
  env: IntakeEnv,
  a: {
    id: string;
    position: Position | null;
    candidate: { profileUrl?: string; cvText?: string };
    senderAllowed: boolean;
  },
  now: Date,
): Promise<{ status: DecidedStatus; runId: string | null; note: string | null }> {
  const { position, candidate, senderAllowed } = a;
  const complete = candidate.profileUrl !== undefined || candidate.cvText !== undefined;
  // A pooled row never starts a run, so the intake cap is not even queried for it (decideStatus ranks pool above capped).
  const pool = position !== null && position.positionId !== null;
  const capped =
    position !== null && !pool && senderAllowed && complete
      ? (await runsStartedSince(env.DB, new Date(now.getTime() - HOUR_MS), "intake")) >= intakeCap(env.INTAKE_PER_HOUR_CAP)
      : false;
  const decision = decideStatus({ tagKnown: position !== null, senderAllowed, candidate, capped, pool });
  if (decision.status !== "run-started" || position === null) return { ...decision, runId: null };
  const run = await startRun(
    env,
    { goal: position.goal, role: position.role, profileUrl: candidate.profileUrl, cvText: candidate.cvText, via: "intake", applicationId: a.id },
    now,
  );
  return { ...decision, runId: run.id };
}

/** A manual add names its position directly; every other channel routes through its intake tag (which may be bound to a position). */
async function findPosition(db: D1Database, input: Partial<Pick<IntakeInput, "source" | "tag" | "positionId">>): Promise<Position | null> {
  if (input.source === "manual") {
    if (input.positionId === undefined) return null;
    const row = await db.prepare("SELECT id, title FROM positions WHERE id = ?").bind(input.positionId).first<{ id: string; title: string }>();
    return row ? { role: row.title, goal: "hiring", positionId: row.id } : null;
  }
  const tag = IntakeTag.safeParse(input.tag);
  if (!tag.success) return null;
  const row = await db
    .prepare("SELECT role, goal, position_id FROM intake_tags WHERE tag = ?")
    .bind(tag.data)
    .first<{ role: string; goal: GoalId; position_id: string | null }>();
  return row ? { role: row.role, goal: row.goal, positionId: row.position_id } : null;
}

async function findExisting(db: D1Database, source: string, externalId: string): Promise<ExistingRow | null> {
  return db
    .prepare(`SELECT ${EXISTING_COLUMNS} FROM applications WHERE source = ? AND external_id = ?`)
    .bind(source, externalId)
    .first<ExistingRow>();
}

function toResult(row: ExistingRow): IntakeResult {
  return { applicationId: row.id, status: row.status, runId: row.run_id, duplicate: true, note: row.note };
}

function isStale(row: ExistingRow, now: Date): boolean {
  return now.getTime() - Date.parse(row.received_at) >= STALE_RECEIVED_MS;
}

/**
 * A row left at 'received' is a delivery that threw after its INSERT (R2, D1 or the Workflow create). The next
 * delivery of the same message runs the same tail from its own payload (CV file and text stored like a first
 * delivery), so the candidate or operator only has to send it again. When the failed attempt had already inserted the
 * run (the throw came after startRun's INSERT), that run is linked, its Workflow instance created if the create was
 * what threw, and no second run starts.
 */
async function resumeReceived(id: string, input: IntakeInput, env: IntakeEnv, now: Date, senderAllowed: boolean): Promise<IntakeResult> {
  const run = await env.DB.prepare("SELECT id FROM investigations WHERE application_id = ?").bind(id).first<{ id: string }>();
  if (run !== null) await ensureRunInstance(env, run.id);
  return decideAndWrite(id, input, env, now, senderAllowed, true, run?.id ?? null);
}

/** `get` throws for an instance that does not exist; then the create that failed the first time is repeated. */
async function ensureRunInstance(env: IntakeEnv, runId: string): Promise<void> {
  try {
    await env.RESEARCH_RUN.get(runId);
  } catch {
    await env.RESEARCH_RUN.create({ id: runId, params: { runId } });
  }
}

/**
 * A delivery that was capped is the one duplicate worth re-deciding: the stored candidate input goes through the same
 * decision tail now, and the run starts if there is room (or the row joins the pool when its tag was bound to a
 * position since). The new payload is ignored; the row keeps what it had (parser and subject notes included, only the
 * cap note goes), and is only written when the run starts or the row pools. The sender check passed when the row was capped.
 */
async function retryCapped(row: ExistingRow, env: IntakeEnv, now: Date): Promise<{ result: IntakeResult; decided: DecidedStatus }> {
  const [position, stored] = await Promise.all([
    findPosition(env.DB, { tag: row.tag ?? undefined }),
    env.DB.prepare("SELECT cv_text FROM applications WHERE id = ?").bind(row.id).first<{ cv_text: string | null }>(),
  ]);
  const candidate = { profileUrl: row.linkedin_url ?? undefined, cvText: stored?.cv_text ?? undefined };
  const decision = await decideAndStart(env, { id: row.id, position, candidate, senderAllowed: true }, now);
  if (decision.status !== "run-started" && decision.status !== "pooled") return { result: toResult(row), decided: decision.status };

  const note = joinNotes(decision.note, ...(row.note?.split("; ").filter((n) => n !== CAPPED_NOTE) ?? []));
  await env.DB.prepare("UPDATE applications SET status = ?, run_id = ?, note = ?, position_id = ? WHERE id = ?")
    .bind(decision.status, decision.runId, note, position?.positionId ?? null, row.id)
    .run();
  return { result: { applicationId: row.id, status: decision.status, runId: decision.runId, duplicate: true, note }, decided: decision.status };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes("UNIQUE constraint failed");
}

/** Var INTAKE_PER_HOUR_CAP; unset, blank or not a number means the default (never "no cap"). */
function intakeCap(raw: string | undefined): number {
  const n = raw === undefined || raw.trim() === "" ? Number.NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : INTAKE_PER_HOUR_CAP_DEFAULT;
}
