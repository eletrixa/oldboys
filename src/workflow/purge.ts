/**
 * Scheduled purge: a run and everything collected for it is deleted RETENTION_DAYS after it was created.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/purge.ts
 * Deps:    bindings DB (D1), SOURCES (R2)
 * Tested:  n/a (I/O only; cron trigger in wrangler.jsonc, handler in src/worker.ts)
 *
 * Key responsibilities:
 * - Backs the privacy line on Screen 1 ("deleted after 7 days"): raw payloads in R2, sources, claims, candidates,
 *   gaps, briefs, calls and the ledger all go, then the investigation row itself
 *
 * Design constraints:
 * - Batches of 20 runs per tick; idempotent, safe to rerun
 */
export const RETENTION_DAYS = 7;
const BATCH = 20;

export async function purgeExpired(db: D1Database, bucket: R2Bucket, now: Date): Promise<{ runs: number }> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let runs = 0;
  for (;;) {
    const old = await db.prepare("SELECT id FROM investigations WHERE created_at < ? LIMIT ?").bind(cutoff, BATCH).all<{ id: string }>();
    if (old.results.length === 0) return { runs };
    for (const { id } of old.results) {
      const keys = await db.prepare("SELECT r2_key FROM sources WHERE run_id = ?").bind(id).all<{ r2_key: string }>();
      if (keys.results.length > 0) await bucket.delete(keys.results.map((k) => k.r2_key));
      await db.batch(
        ["sources", "claims", "candidates", "gaps", "briefs", "calls", "ledger_entries"].map((table) =>
          db.prepare(`DELETE FROM ${table} WHERE run_id = ?`).bind(id),
        ),
      );
      await db.prepare("DELETE FROM investigations WHERE id = ?").bind(id).run();
      runs += 1;
    }
  }
}
