/**
 * Scheduled purge: delete raw payloads and source rows whose TTL passed (hackathon rule: raw data is not kept).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/purge.ts
 * Deps:    bindings DB (D1), SOURCES (R2)
 * Tested:  n/a (I/O only; the cron trigger lives in wrangler.jsonc, the handler in src/worker.ts)
 *
 * Key responsibilities:
 * - Every source carries `expires_at` (7 days after fetch); past that the R2 object and the D1 row are deleted
 * - Claims keep their quote and source id, so a brief stays readable after the raw payload is gone
 *
 * Design constraints:
 * - Batches of 100 so one cron tick never holds a long D1 transaction; idempotent, safe to rerun
 */
const BATCH = 100;

export async function purgeExpired(db: D1Database, bucket: R2Bucket, now: Date): Promise<{ deleted: number }> {
  let deleted = 0;
  for (;;) {
    const rows = await db
      .prepare("SELECT id, r2_key FROM sources WHERE expires_at < ? LIMIT ?")
      .bind(now.toISOString(), BATCH)
      .all<{ id: string; r2_key: string }>();
    if (rows.results.length === 0) return { deleted };
    await bucket.delete(rows.results.map((r) => r.r2_key));
    await db.batch(rows.results.map((r) => db.prepare("DELETE FROM sources WHERE id = ?").bind(r.id)));
    deleted += rows.results.length;
  }
}
