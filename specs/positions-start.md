---
spec: positions-start
status: draft
plan: 007
created: 2026-10-08
---
# positions-start

## Intent
A research run can start from a position. The position's must-haves become the run's questions, so every candidate for it is rated against the same bar.

## Contract
Files: `src/app/api/_lib/run-body.ts`, `src/app/api/runs/route.ts`, `src/app/api/runs/[id]/state/route.ts`, `src/domain/run-state.ts` or wherever the state shape lives (find the state type the state route returns).
Tests: `src/app/api/_lib/__tests__/run-body.test.ts` (extend), a new `src/app/api/runs/__tests__/start-from-position.test.ts` for the extracted insert function, and the state test if one exists.

- `StartRunBody.positionId?: string`, trimmed, 1..64 chars, characters `[A-Za-z0-9_-]` only. It is allowed only for `goal: "hiring"`; for other goals it is a validation error.
- Extract the INSERT and position lookup from `POST` into a function in `src/app/api/runs/start.ts`, `insertRun(db, input)`, so it is testable with a fake D1. `route.ts` stays the thin handler.
- When `positionId` is present:
  - Load the position (`id`, `title`, `must_haves_json`). Not found: 404 `{ error: "unknown position" }` and no insert.
  - Insert sets `position_id = position.id`, `role = position.title`, `questions_json = JSON.stringify(mustHavesToQuestions(position))`. A `role` in the body is ignored.
  - An expired but not yet purged position is still usable.
- When `positionId` is absent: the INSERT statement and its bound values are exactly those of today (no `position_id` column named), so an un-migrated remote database keeps working. Test by inspecting the prepared SQL string of the fake D1.
- `GET /api/runs/:id/state` adds `position: { id: string; title: string } | null`, from a LEFT JOIN on `investigations.position_id`; `null` for runs without one or whose position was purged. Existing fields are unchanged.
- The Workflow needs no change: `research-run.ts` runs `role_questions` only when `questions_json === null`, so a pre-filled `questions_json` skips that step. Assert this in a test against the guard if it can be reached without a Workflow runtime; otherwise assert that `insertRun` never leaves `questions_json` null when a position is given.
- The ledger note and the interview kit "Hiring for:" line read `investigations.role`, which now equals the position title; no code change there.

## Invariants
- `questions_json` is a copy taken at run start; later edits to the position do not alter existing runs.
- Same position, same `questions_json` for every run started from it (until the position is edited).
- Existing rate limits, dedupe by `sourceUrl`, and budgets behave as before.

## Acceptance
- [ ] S1: `StartRunBody` accepts `positionId` with a hiring goal and a profileUrl; output carries it.
- [ ] S2: rejects `positionId` with an empty string, 65 chars, or characters like `;` and spaces.
- [ ] S3: rejects `positionId` with goal `due-diligence`.
- [ ] S4: a hiring body with `positionId` and nothing else (no profile, CV or subject) is still rejected (candidate identity is required).
- [ ] S5: `insertRun` with a known position binds `position_id`, `role = position.title`, and `questions_json` equal to `JSON.stringify(mustHavesToQuestions(position))`.
- [ ] S6: a body `role` of `"Something else"` together with `positionId` is ignored: stored role is the position title.
- [ ] S7: unknown `positionId` returns the 404 outcome and the fake D1 saw no INSERT.
- [ ] S8: without `positionId` the SQL text does not contain `position_id`, and the bound values equal the pre-change list.
- [ ] S9: two runs from the same position store byte-identical `questions_json`.
- [ ] S10: editing the position after the first run does not change the first run's stored `questions_json`.
- [ ] S11: the state response for a run with a position has `position: { id, title }`; for a run without, `position: null`; all pre-existing keys still present.
- [ ] S12: the stored `questions_json` is non-null, so the Workflow guard `head.questions_json === null` is false (assert on the parsed value being a non-empty array).
