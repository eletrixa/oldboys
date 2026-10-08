# 00 — Synthesis: candidate pool per position (ADR)

**Question**: How does a recruiter working with a position curate and enrich a pool of candidates instead of auto-starting research on every intake, before closing the pool feature by the 72h demo freeze?

**Scope**: bind intake tags to positions to pool instead of auto-starting; manual candidate add by LinkedIn URL or pasted CV; start enrichment for selected pooled candidates with the position's must-haves as questions. **Out of scope**: ranks, scores, verdicts on candidates; auto-enrichment on tag binding; email notifications to candidates; candidate communication or consent workflows; ranking by sources; position-wide searches.

## Context

- Plan 007 added positions with must-haves, so the same questions go to every candidate for that position. Without pooling, all intake applications auto-start runs, which is expensive and undifferentiating.
- Every candidate added to a position should get its must-haves, so enrichment is role-specific and comparable. A recruiter wants to curate before research starts: hand-add promising candidates, skip the unfit.
- Intake statuses today are `received → run-started | unmatched | incomplete | capped`. Plan 010 adds `pooled` for candidates waiting for enrichment, conditional on a position binding.
- A tag is the routing key (email address, apply page, StartupJobs mapping). One tag can feed multiple positions over time, but at any moment it is bound to one or none: if a tag is deleted from a position, new applications with that tag revert to auto-start (no position). Manual add always pools because it targets one position explicitly.

## Decision

**Intake status is governed by two rules**:

1. **Tag + position**: applications go to `pooled`. No automatic run. Manual `POST /api/positions/:id/enrich` on selected rows starts runs (max 20 per call, hourly caps apply).
2. **Tag + no position**: unchanged plan 008 behaviour. Known tag → `run-started`, unknown tag → `unmatched`, no LinkedIn/CV → `incomplete`, hourly cap → `capped`.

Manual candidate add (`POST /api/positions/:id/candidates`) always pools, because it names the position explicitly. Binding a tag to a position does not trigger retroactive enrichment of earlier `run-started` rows.

## Contracts

- **Migration 0012** (`migrations/0012_candidate_pool.sql`): Rebuild `applications` table (SQLite cannot ALTER CHECK); add `position_id TEXT REFERENCES positions(id)`, `status IN ('received','pooled','run-started','unmatched','incomplete','capped')`; add column to `intake_tags`; create indexes `idx_applications_position` and `idx_intake_tags_position`.
- **Domain** (`src/domain/application.ts`): `ApplicationSource` gains `"manual"`, `ApplicationStatus` gains `"pooled"`. `IntakeInput` gains `positionId?: POSITION_ID` with superRefine requiring `positionId` when `source === "manual"`. `decideStatus(args)` gets `pool: boolean` parameter; order: unmatched (tag/position unknown) > unmatched (sender) > incomplete > `pooled` (when true) > capped > run-started.
- **Funnel** (`src/workflow/intake.ts`): `findPosition` returns `{ role, goal, positionId: string | null } | null`. Pool when `positionId` is non-null. `pool = true` → status `pooled`, no run, `position_id` written to UPDATE. `pool = false` → existing logic. CV file kept in R2 for pooled rows too (can become a run later).
- **Enrichment** (new `src/workflow/enrich.ts`): `startEnrichment(env, args: {positionId, applicationIds, origin}, now) → {ok: boolean, started: {applicationId, runId}[], skipped: {applicationId, reason}}`. Load position (`404` if not found). Dedupe and cap ids at `ENRICH_MAX=20`. Load applications filtered to pooled status and position. Cap runs: check `runsStartedSince(DB, now-1h)` + eligible > `RUNS_PER_HOUR_CAP` → 429; for `via='start'` also cap per organization against `START_PER_HOUR_CAP`. For each eligible, `startRun({..., via, applicationId, position, ...})` then `UPDATE applications SET status='run-started', run_id=?`.
- **API** (lane B): `POST /api/positions/:id/candidates` (session or bearer): `{name?, email?, linkedinUrl ≤500, cvText ≤CV_MAX}` (one required) → 201 `{applicationId, status, duplicate, note}`. `POST /api/positions/:id/enrich` (session or bearer): `{applicationIds: string[]}` (1..20) → 200 `{started, skipped}` or 429/404.
- **UI** (lane C): Position page gains **Candidates** section: "Add a candidate" form + pool table (name, source, received, status, has profile/CV, run link); "Start enrichment (n)" button. **Intake channels** section: bind tag to position (`POST /api/intake/tags` with `positionId`).
- **Docs**: New section in `docs/ops/intake.md`; `specs/intake/00-overview.md` notes the pool evolution; `plans/010-candidate-pool/00-SYNTHESIS.md` (this file); `CLAUDE.md` and `CHANGELOG.md` updated.

## Top 3 reasons

1. It is the minimum change to give a recruiter human control over which candidates get expensive research. Pooling is opt-in per position; tags without a position keep working.
2. The position must-haves become actionable: a recruiter pools candidates by judgment (hand-add or bind intake channels) and research is only for them, not every application ever.
3. Statuses remain simple and deterministic: tag + position → pooled, tag + no position → auto-start as before. No new async logic or background jobs.

## Top 3 risks

1. **Migration 0012 is mandatory before deploy**: it rebuilds `applications` (SQLite cannot alter a CHECK). Robert must run `pnpm db:migrate:remote` before merge. CI cannot migrate D1, so a PR adding this migration must explicitly say so.
2. **Orphaned applications after position delete**: purge sweeps already null out `applications.position_id` and `intake_tags.position_id` for deleted positions (plan 007 purge + this update), so no foreign key constraint is violated. Rows stay pooled but unreachable from `/positions/<id>`; they are purged with the position.
3. **Tag re-binding changes enrichment semantics**: a tag moved from position A to B does not re-enrich earlier pooled candidates from A (they stay in A's pool and must be enriched there before the tag moves). Design choice: simpler than tracking candidates through position transitions.

## Migration and deploy

The intake migration (`0009_intake.sql`) and the pool migration (`0012_candidate_pool.sql`) must both be applied to prod D1 before deploying. Robert runs `pnpm db:migrate:remote` once before merge.
