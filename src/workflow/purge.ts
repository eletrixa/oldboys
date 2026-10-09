/**
 * Run deletion: deleteRunData removes one run and everything collected for it; the scheduled purge calls it RETENTION_DAYS
 * after a run was created (positions at their own expiry), POST /api/runs/:id/delete calls it at once on rejection or request.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/purge.ts
 * Deps:    bindings DB (D1), SOURCES (R2), src/domain/audit (RETENTION_DAYS), src/domain/deletion (DeletionCounts), src/domain/report-translation (translationKeys), src/domain/call-questions-llm (callQuestionsKey)
 * Tested:  src/workflow/__tests__/purge.test.ts (deleteRunData, runs, applications), src/workflow/__tests__/purge-positions.test.ts (positions sweep); cron trigger in wrangler.jsonc, handler in src/worker.ts
 *
 * Key responsibilities:
 * - deleteRunData(db, bucket, runId): the single per-run delete, returns DeletionCounts (rows per table from the batch's
 *   meta.changes, CV files, R2 objects); used by purgeExpired and the on-demand delete route
 * - Backs the privacy line on Screen 1 ("deleted after 7 days"): raw payloads in R2, sources, claims, candidates,
 *   gaps, briefs, calls (with their R2 result objects and webhook events) and the ledger all go, then the run row
 * - The cached Czech translation of the brief (idea #24, `translations/<runId>/brief-cs.json`) and the cached AI call
 *   questions (`call-questions/<runId>.json`) go with the R2 objects; each is counted only when it exists (head first)
 * - Intake applications (contact data, CV text, cover letter) and their CV files in R2 (intake/<id>/<file>) go with
 *   their run, before the run row (applications.run_id references it); applications that never started a run go
 *   RETENTION_DAYS after received_at
 * - Positions (plans/007) go at their own `expires_at`, after the runs sweep: R2 objects, then one `db.batch` per batch of ids
 *   that sets `position_id` NULL on investigations, applications and intake_tags and deletes the rows
 *
 * Design constraints:
 * - deleteRunData never stops Workflows; the delete route terminates them first (src/workflow/stop-run.ts)
 * - Batches of 20 runs / applications / positions per tick; idempotent, safe to rerun
 * - The UPDATE of `position_id` comes before the position DELETE so the foreign key never blocks
 * - A missing `positions` table (un-migrated database) must not break the runs purge; any other error propagates
 * - RETENTION_DAYS lives in src/domain/audit.ts so the audit record's deletion date matches this purge
 */
import { RETENTION_DAYS } from "@/domain/audit";
import type { DeletionCounts } from "@/domain/deletion";
import { translationKeys } from "@/domain/report-translation";
import { callQuestionsKey } from "@/domain/call-questions-llm";

const BATCH = 20;

type ApplicationRow = { id: string; cv_key: string | null };

function cvKeys(apps: ApplicationRow[]): string[] {
  return apps.flatMap((a) => (a.cv_key === null ? [] : [a.cv_key]));
}

/** Child tables deleted per run, in this order (claims before candidates; applications before the run row). */
const RUN_TABLES = ["sources", "claims", "candidates", "gaps", "briefs", "calls", "ledger_entries", "applications"] as const;

/**
 * Delete one run and everything collected for it: R2 objects first, then the child rows in one batch, then the run row.
 * Shared by the scheduled purge and the on-demand delete (POST /api/runs/:id/delete) so the two never drift apart.
 */
export async function deleteRunData(db: D1Database, bucket: R2Bucket, runId: string): Promise<DeletionCounts> {
  const [keys, calls, apps] = await Promise.all([
    db.prepare("SELECT r2_key FROM sources WHERE run_id = ?").bind(runId).all<{ r2_key: string }>(),
    db
      .prepare("SELECT result_r2_key, provider_conversation_id FROM calls WHERE run_id = ?")
      .bind(runId)
      .all<{ result_r2_key: string | null; provider_conversation_id: string | null }>(),
    db.prepare("SELECT id, cv_key FROM applications WHERE run_id = ?").bind(runId).all<ApplicationRow>(),
  ]);
  const translations = await existingKeys(bucket, [...translationKeys(runId), callQuestionsKey(runId)]);
  const cvFiles = cvKeys(apps.results);
  const objects = [
    ...keys.results.map((k) => k.r2_key),
    ...calls.results.flatMap((c) => (c.result_r2_key === null ? [] : [c.result_r2_key])),
    ...cvFiles,
    ...translations,
  ];
  if (objects.length > 0) await bucket.delete(objects);
  const conversations = calls.results.flatMap((c) => (c.provider_conversation_id === null ? [] : [c.provider_conversation_id]));
  const results = await db.batch([
    ...RUN_TABLES.map((table) => db.prepare(`DELETE FROM ${table} WHERE run_id = ?`).bind(runId)),
    ...conversations.map((cid) => db.prepare("DELETE FROM webhook_events WHERE conversation_id = ?").bind(cid)),
  ]);
  await db.prepare("DELETE FROM investigations WHERE id = ?").bind(runId).run();
  const changes = (i: number): number => results[i]?.meta.changes ?? 0;
  const deleted = (table: (typeof RUN_TABLES)[number]): number => changes(RUN_TABLES.indexOf(table));
  let webhookEvents = 0;
  for (let i = RUN_TABLES.length; i < results.length; i += 1) webhookEvents += changes(i);
  return {
    sources: deleted("sources"),
    claims: deleted("claims"),
    candidates: deleted("candidates"),
    gaps: deleted("gaps"),
    briefs: deleted("briefs"),
    calls: deleted("calls"),
    ledger_entries: deleted("ledger_entries"),
    applications: deleted("applications"),
    webhook_events: webhookEvents,
    cv_files: cvFiles.length,
    r2_objects: objects.length,
  };
}

/** The keys that exist in the bucket (a run translated on demand has its cache object; most runs have none). */
async function existingKeys(bucket: R2Bucket, keys: readonly string[]): Promise<string[]> {
  const heads = await Promise.all(keys.map((key) => bucket.head(key)));
  return keys.filter((_, i) => heads[i] !== null);
}

export async function purgeExpired(db: D1Database, bucket: R2Bucket, now: Date): Promise<{ runs: number; applications: number; positions: number }> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let runs = 0;
  let applications = 0;
  for (;;) {
    const old = await db.prepare("SELECT id FROM investigations WHERE created_at < ? LIMIT ?").bind(cutoff, BATCH).all<{ id: string }>();
    if (old.results.length === 0) break;
    for (const { id } of old.results) {
      const counts = await deleteRunData(db, bucket, id);
      runs += 1;
      applications += counts.applications;
    }
  }
  // Applications that never started a run (unmatched, incomplete, capped) expire from received_at.
  for (;;) {
    const old = await db
      .prepare("SELECT id, cv_key FROM applications WHERE run_id IS NULL AND received_at < ? LIMIT ?")
      .bind(cutoff, BATCH)
      .all<ApplicationRow>();
    if (old.results.length === 0) return { runs, applications, positions: await purgePositions(db, bucket, now) };
    const objects = cvKeys(old.results);
    if (objects.length > 0) await bucket.delete(objects);
    await db.batch(old.results.map((a) => db.prepare("DELETE FROM applications WHERE id = ?").bind(a.id)));
    applications += old.results.length;
  }
}

async function tableExists(db: D1Database, name: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?").bind(name).first();
  return row !== null;
}

async function purgePositions(db: D1Database, bucket: R2Bucket, now: Date): Promise<number> {
  if (!(await tableExists(db, "positions"))) return 0;
  let positions = 0;
  for (;;) {
    const { results } = await db
      .prepare("SELECT id, r2_key FROM positions WHERE expires_at < ? LIMIT ?")
      .bind(now.toISOString(), BATCH)
      .all<{ id: string; r2_key: string | null }>();
    if (results.length === 0) return positions;
    const keys = results.flatMap((p) => (p.r2_key === null ? [] : [p.r2_key]));
    if (keys.length > 0) await bucket.delete(keys);
    const ids = results.map((p) => p.id);
    const marks = ids.map(() => "?").join(", ");
    await db.batch([
      ...["investigations", "applications", "intake_tags"].map((table) =>
        db.prepare(`UPDATE ${table} SET position_id = NULL WHERE position_id IN (${marks})`).bind(...ids),
      ),
      db.prepare(`DELETE FROM positions WHERE id IN (${marks})`).bind(...ids),
    ]);
    positions += ids.length;
  }
}
