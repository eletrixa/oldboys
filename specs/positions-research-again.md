---
spec: positions-research-again
status: implemented
plan: 016
created: 2026-10-09
---
# positions-research-again

## Intent
A candidate whose research is finished can be researched again from the position page, so people who were in a pool before a recipe change (treg second source, plan 016) get the new sources without being added a second time. The row keeps its identity; only its run link moves to the new run.

## Contract
Files: `src/workflow/enrich.ts`, `src/app/positions/pool-rows.ts`, `src/app/positions/candidate-pool.tsx`.
Tests: `src/workflow/__tests__/enrich.test.ts`, `src/app/positions/__tests__/pool-rows.test.ts`.

- `startEnrichment` reads each application with its run: `status`, `linkedin_url`, `cv_text`, `run_id`, the run's `status` (`run_status`, null when the run was deleted) and its last activity (`run_last_at`: newest ledger `ts`, else the run's `created_at`).
- A row is eligible when it has a LinkedIn URL or CV text and either
  - `status = 'pooled'`, or
  - `status = 'run-started'` and its run is finished: `run_id` points to no run, or `run_status` is `done` or `failed`, or `isStalled(run_status, run_last_at, now)` (queued/running with no ledger activity for `STALLED_AFTER_MINUTES`).
- A `run-started` row whose run is queued, running or paused (and not stalled) is skipped as "already started" with its `runId`, as today. A `run-started` row with `run_id` null (a start in flight) is "already started" without a `runId`.
- Claim before start: one `UPDATE applications SET status = 'run-started', run_id = NULL WHERE id = ? AND status = ? AND run_id IS ?`, bound to the values just read. Zero changed rows = another request got there first: skipped "already started".
- When `startRun` throws, the row gets back exactly the `status` and `run_id` it had before the claim.
- The response shape (`started`, `skipped`) is unchanged; a research-again row appears in `started` like a pooled one.
- `shapePool`: `selectable` is true for a row with a profile or CV that is `pooled`, or `run-started` with a `run_id` and `run` null (deleted), `run.status` `done`/`failed`, or `run.stalled`; a `run-started` row with `run_id` null is a start in flight and not selectable. Status labels, the "Research selected (n)" button and the run link are unchanged; after the start the row shows the new run.

## Invariants
- A candidate is never duplicated: research again creates a new investigation, never a new application row.
- Two concurrent requests for the same finished row start one run.
- Hourly caps and `ENRICH_MAX` apply to research-again rows exactly as to pooled rows.
- The old run is not deleted; it stays reachable at its URL and in the run list.

## Acceptance
- [x] A1: a `run-started` row whose run is `done` starts a new run; the row ends `run-started` with the new `run_id`.
- [x] A2: a `run-started` row whose run is `failed`, deleted (no investigation), or stalled (running, last ledger activity older than the limit) starts a new run.
- [x] A3: a `run-started` row whose run is `running` with recent activity, or `paused`, is skipped "already started" with its `runId`.
- [x] A4: the claim statement binds the read status and run id; when it changes no row, the row is skipped "already started" and no run starts.
- [x] A5: when `startRun` throws for a research-again row, the row's `status` and `run_id` are the values before the claim.
- [x] A6: `shapePool` marks selectable: pooled with profile; done, failed, stalled, and run-missing (`run_id` set, `run` null) `run-started` rows with profile; not selectable: `run-started` running or paused, `run-started` with `run_id` null (start in flight), and any row without profile or CV.
