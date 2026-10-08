---
spec: positions-api
status: draft
plan: 007
created: 2026-10-08
---
# positions-api

## Intent
Session-or-bearer protected JSON routes to create, list, read and edit positions. Handlers stay thin; behaviour lives in tested functions.

## Contract
Files:
- `src/app/api/_lib/position-body.ts`: Zod `CreatePositionBody`, `PatchPositionBody`. Test `src/app/api/_lib/__tests__/position-body.test.ts`.
- `src/app/api/positions/handler.ts`: `listPositions(db)`, `getPosition(db, id)`, `patchPosition(db, id, body)`; creation is `ingestPosition` from `positions-ingest`. It also exports the route functions `createPositionRoute(request, env, over?)`, `listPositionsRoute(request, env)`, `getPositionRoute(request, env, id)`, `patchPositionRoute(request, env, id)` (session-or-bearer check, body parse, tested function, no-store); `route.ts` files only pass `getCloudflareContext().env`. Test `src/app/api/positions/__tests__/handler.test.ts` with a fake D1.
- The overview group is built inline in `getPosition` with the exported `buildGroup` of `role-overview.ts` (`key = position.id`, `role = position.title`); `null` when the position has no hiring runs. There is no separate `position-overview` module; B11-B12 live in `handler.test.ts`.
- Files: D1 functions and the shared `loadPosition` read path in `handler.ts`; the guarded `*Route` functions in `routes.ts` (one no-store wrapper); the role-run SELECT shared with `GET /api/roles` in `_lib/role-rows.ts`. The public `[id]/summary` route reads through `loadPosition`.
- `src/app/api/positions/route.ts` (`POST`, `GET`) and `src/app/api/positions/[id]/route.ts` (`GET`, `PATCH`): guard with `requireSessionOrBearer(request, env)` (`_lib/session-or-bearer.ts`) first: a valid session cookie, or the bearer `RUN_TOKEN` for curl and the extension; no Authorization header and no session is 401 `{ error: "login required" }`, a presented bearer is judged by `requireBearer` (401 wrong, 503 secret unset), body parse with `parseJsonBody`, then the tested function. No `runtime = "edge"`.

### Bodies
- `CreatePositionBody`: `{ postingText?: string (trimmed, 1..20000), postingUrl?: url (<= 500), title?: string (trimmed, 1..300) }`. At least one of `postingText` or `postingUrl` is required; `title` alone is a 400.
- `PatchPositionBody`: `{ title?: string (1..300), family?: Family, must_haves?: MustHaves (1..5 items, `mh-` ids) }`. At least one key is required; unknown keys are rejected (strict).

### Routes
| Route | Success | Errors |
|---|---|---|
| `POST /api/positions` | 201 `{ id, notes }` (notes from ingest, may be empty); 200 `{ id, reused: true }` when ingest returns reused | 400 bad body, 401 no session or wrong bearer, 503 bearer with RUN_TOKEN unset, 422 `{ error }` from ingest |
| `GET /api/positions` | 200 `{ positions: [...] }` newest first by `created_at` | 401/503 |
| `GET /api/positions/:id` | 200 `{ position, runs, group }` | 404 `{ error }`, 401/503 |
| `PATCH /api/positions/:id` | 200 `{ position }` (the updated row) | 400, 404, 401/503 |

- List item: `{ id, title, family, company, location, posting_url, ingest_method, created_at, expires_at, runs }`, `runs` = count of investigations with that `position_id` (LEFT JOIN, 0 when none). `must_haves` and `excerpt` are not in the list.
- Detail: `position` is the full `Position` shape of `positions-domain` (`must_haves` parsed into an array, never the JSON string). `runs` = `[{ id, subject, status, created_at }]` newest first, derived from the same role-run rows as `group` (so hiring runs only, cap 500). `group` = the overview over the position's hiring runs (rows read like `GET /api/roles`: questions_json, brief_json, sources_confirmed), or `null`.
- PATCH writes only the given columns, stores `must_haves` as JSON (and then sets `extraction = 'edited'`), and does not touch `expires_at`. It does not change `questions_json` of runs that already exist (runs keep the copy they started with).
- Every response, including errors, carries `Cache-Control: no-store`.
- `:id` that is not found, or is not a plausible id (longer than 64 chars), is 404, never 500.

## Invariants
- No route works without a session or the bearer token; positions are team-shared (no organization column), so any logged-in account sees all of them; the check happens before the body is read.
- A malformed stored `must_haves_json` yields `must_haves: []` in responses and never throws.
- The API never returns `r2_key`.

## Acceptance
- [ ] B1: `CreatePositionBody` accepts text only, URL only, and both; rejects empty object, title only, text over 20000 chars, URL over 500 chars, non-URL string.
- [ ] B2: `PatchPositionBody` accepts each single key; rejects empty object, unknown key, family `legal`, 6 must-haves, a must-have id without `mh-`, empty must-haves array.
- [ ] B3: `listPositions` returns newest first and a run count of 0 for a position without runs and 2 for one with two investigations.
- [ ] B4: list items contain no `must_haves`, `excerpt` or `r2_key` keys.
- [ ] B5: `getPosition` returns the position with `must_haves` as an array, its runs newest first, and a `group` whose `key` is the position id.
- [ ] B6: `getPosition` of an unknown id returns null (route maps to 404 `{ error }`).
- [ ] B7: a row with broken `must_haves_json` returns `must_haves: []`.
- [ ] B8: `patchPosition` updates title only and leaves family and must-haves unchanged.
- [ ] B9: `patchPosition` with `must_haves` stores valid JSON that parses back to the same array; `expires_at` unchanged.
- [ ] B10: `patchPosition` on an unknown id returns null (404).
- [ ] B11: `getPosition` gives `group: null` for no runs; for runs of one position it returns one group with `role` = position title, `run_count` = rows, runs newest first, and cell labels from the briefs (reuse the fixtures style of `role-overview.test.ts`).
- [ ] B12: `getPosition` shows a run without a brief as `not checked` in every cell.
- [ ] B13: route-level (call the exported handlers with a stub env): each of the four routes returns 401 without a session or bearer and 503 for a bearer when `RUN_TOKEN` is unset; success responses have `Cache-Control: no-store`.
- [ ] B14: `POST` maps ingest `{ reused: true }` to status 200 and a new id to 201; `{ ok: false, status: 422 }` to 422 with the error text.
- [ ] B14: `requireSessionOrBearer` accepts a valid session cookie, rejects an expired one, accepts the right bearer, rejects a wrong one, 503 without secret, 401 anonymous (`_lib/__tests__/session-or-bearer.test.ts`).
