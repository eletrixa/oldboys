/**
 * Scheduled purge: a run and everything collected for it is deleted RETENTION_DAYS after it was created.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/purge.ts
 * Deps:    bindings DB (D1), SOURCES (R2), src/domain/audit (RETENTION_DAYS)
 * Tested:  src/workflow/__tests__/purge-positions.test.ts (applications and positions sweeps, sweep order); runs sweep n/a (cron trigger in wrangler.jsonc, handler in src/worker.ts)
 *
 * Key responsibilities:
 * - Backs the privacy line on Screen 1 ("deleted after 7 days"): raw payloads in R2, sources, claims, candidates,
 *   gaps, briefs, calls (with their R2 result objects and webhook events) and the ledger all go, then the run row
 * - Applications (plans/008) received RETENTION_DAYS ago go first: their R2 CV files, then the rows (name, e-mail, phone, CV text)
 * - Positions (plans/007) go at their own `expires_at`: R2 objects, then one `db.batch` per batch of ids that sets `investigations.position_id` NULL and deletes the rows
 *
 * Design constraints:
 * - Applications before runs: `applications.run_id` references `investigations`, and an application is never younger than
 *   the run it started, so every expired run's application row is gone before the run row is deleted
 * - Batches of 20 applications, then 20 runs, then 20 positions; the UPDATE of `position_id` comes before the position DELETE so the foreign key never blocks
 * - A missing `applications` or `positions` table (un-migrated database) must not break the runs purge; any other error propagates
 * - Batches of 20 runs per tick; idempotent, safe to rerun
 * - RETENTION_DAYS lives in src/domain/audit.ts so the audit record's deletion date matches this purge
 */
import { RETENTION_DAYS } from "@/domain/audit";

const BATCH = 20;

async function tableExists(db: D1Database, name: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?").bind(name).first();
  return row !== null;
}

async function purgeApplications(db: D1Database, bucket: R2Bucket, cutoff: string): Promise<number> {
  if (!(await tableExists(db, "applications"))) return 0;
  let applications = 0;
  for (;;) {
    const { results } = await db
      .prepare("SELECT id, cv_key FROM applications WHERE received_at < ? LIMIT ?")
      .bind(cutoff, BATCH)
      .all<{ id: string; cv_key: string | null }>();
    if (results.length === 0) return applications;
    const keys = results.flatMap((a) => (a.cv_key === null ? [] : [a.cv_key]));
    if (keys.length > 0) await bucket.delete(keys);
    const ids = results.map((a) => a.id);
    await db.prepare(`DELETE FROM applications WHERE id IN (${ids.map(() => "?").join(", ")})`).bind(...ids).run();
    applications += ids.length;
  }
}

async function purgeRuns(db: D1Database, bucket: R2Bucket, cutoff: string): Promise<number> {
  let runs = 0;
  for (;;) {
    const old = await db.prepare("SELECT id FROM investigations WHERE created_at < ? LIMIT ?").bind(cutoff, BATCH).all<{ id: string }>();
    if (old.results.length === 0) return runs;
    for (const { id } of old.results) {
      const [keys, calls] = await Promise.all([
        db.prepare("SELECT r2_key FROM sources WHERE run_id = ?").bind(id).all<{ r2_key: string }>(),
        db
          .prepare("SELECT result_r2_key, provider_conversation_id FROM calls WHERE run_id = ?")
          .bind(id)
          .all<{ result_r2_key: string | null; provider_conversation_id: string | null }>(),
      ]);
      const objects = [...keys.results.map((k) => k.r2_key), ...calls.results.flatMap((c) => (c.result_r2_key === null ? [] : [c.result_r2_key]))];
      if (objects.length > 0) await bucket.delete(objects);
      const conversations = calls.results.flatMap((c) => (c.provider_conversation_id === null ? [] : [c.provider_conversation_id]));
      await db.batch([
        ...["sources", "claims", "candidates", "gaps", "briefs", "calls", "ledger_entries"].map((table) =>
          db.prepare(`DELETE FROM ${table} WHERE run_id = ?`).bind(id),
        ),
        ...conversations.map((cid) => db.prepare("DELETE FROM webhook_events WHERE conversation_id = ?").bind(cid)),
      ]);
      await db.prepare("DELETE FROM investigations WHERE id = ?").bind(id).run();
      runs += 1;
    }
  }
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
      db.prepare(`UPDATE investigations SET position_id = NULL WHERE position_id IN (${marks})`).bind(...ids),
      db.prepare(`DELETE FROM positions WHERE id IN (${marks})`).bind(...ids),
    ]);
    positions += ids.length;
  }
}

export async function purgeExpired(db: D1Database, bucket: R2Bucket, now: Date): Promise<{ runs: number; positions: number; applications: number }> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const applications = await purgeApplications(db, bucket, cutoff);
  const runs = await purgeRuns(db, bucket, cutoff);
  return { runs, positions: await purgePositions(db, bucket, now), applications };
}
