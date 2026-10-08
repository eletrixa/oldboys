---
spec: positions-purge
status: draft
plan: 007
created: 2026-10-08
---
# positions-purge

## Intent
Positions and their stored posting payloads follow the same retention as runs and sources: gone after `RETENTION_DAYS`.

## Contract
File `src/workflow/purge.ts`, test `src/workflow/__tests__/purge-positions.test.ts` (there is no existing purge test, so this one builds a small fake D1 and fake R2 in the test file; keep them minimal and local, record `prepare().bind()` statements and `bucket.delete` calls).

- `purgeExpired(db, bucket, now)` returns `{ runs: number; positions: number }`. The `runs` behaviour is unchanged; the header comment and the `Tested:` line are updated.
- Positions sweep runs after the runs sweep, in batches of 20: `SELECT id, r2_key FROM positions WHERE expires_at < ? LIMIT 20` with `now.toISOString()`.
- For each batch: delete the non-null R2 keys with one `bucket.delete(keys)` call, then `UPDATE investigations SET position_id = NULL WHERE position_id = ?` for each id (decision: set NULL, the run keeps its own `questions_json` copy and role text), then `DELETE FROM positions WHERE id = ?`. Ordering matters: the UPDATE comes before the DELETE so the foreign key never blocks.
- Loop until a batch returns no rows. Idempotent; safe to rerun.
- Uses the same `RETENTION_DAYS` import from `src/domain/audit.ts` when computing `expires_at` at ingest (`positions-ingest`); the sweep itself compares against `expires_at`, not `created_at`.
- A position whose `expires_at` is in the future is untouched, even when its linked runs are already purged.
- If the `positions` table does not exist yet (un-migrated database), the sweep must not break the runs purge: catch the "no such table" error from the positions query, return `positions: 0`, and let any other error propagate.

## Invariants
- No position row, R2 object or `position_id` reference to a purged position survives a completed sweep.
- Runs of a purged position remain until their own retention ends; only the link is cleared.
- Raw posting payloads never outlive `expires_at`.

## Acceptance
- [ ] U1: an expired position with an R2 key is deleted from D1 and its key is passed to `bucket.delete`.
- [ ] U2: a position with `expires_at` one second in the future is not deleted and its key is not passed to R2.
- [ ] U3: a position with `r2_key` null is deleted and does not add a null to the delete call.
- [ ] U4: investigations referencing the purged position get `position_id = NULL`, and the UPDATE statement is recorded before the DELETE statement.
- [ ] U5: 45 expired positions are processed in batches of 20 (three SELECTs returning rows plus one empty), and the result reports `positions: 45`.
- [ ] U6: running the sweep twice in a row deletes nothing the second time and returns `positions: 0`.
- [ ] U7: the runs sweep result is unchanged (`runs` count) when there are no positions.
- [ ] U8: a "no such table: positions" error from the positions query yields `positions: 0` and does not reject; a different error rejects.
