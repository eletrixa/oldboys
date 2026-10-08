# 10 — Deep dive: codebase seams and constraints

Read on 2026-10-08 against the working tree (which includes the peer session's staged `roles` feature, idea #16).

## What already exists for "role"
- `investigations.role` (free text, migration 0003) and `investigations.questions_json` (the `mh-*` must-have questions the LLM derives from the role).
- `role_questions` is an inline `step.do` in `src/workflow/research-run.ts:110-120`, not a recipe step. It runs only when `role` is non-empty **and `questions_json IS NULL`**. A row inserted with `questions_json` pre-filled skips the LLM call. This is the seam a position can use.
- `roleQuestions(role, ports, anchor)` in `src/recipe/seams/role.ts` (106 lines): one primary LLM call, `MustHaves` schema `{id, text, accepted_evidence[]}`, max 5, deterministic fallback of 3 questions. `ctx.role` itself never reaches extract or synthesize; only the `mh-*` questions do (`extract.ts:63`, `synthesize.ts:261-279`). So "position-conditioned research" = control over `questions_json`.
- Peer feature (staged, uncommitted): `GET /api/roles` + `/roles`, `/roles/[key]` group hiring runs by `roleKey(role)` (trim, collapse whitespace, lower-case) and show coverage per must-have, union of question texts across runs. Pure projection `src/domain/role-overview.ts`. Bearer `RUN_TOKEN` is required, held in `sessionStorage` by the page. **This is already a position selector in the thin sense: role text is the position key.**

## Start path
- `StartRunBody` (`src/app/api/_lib/run-body.ts:36-60`) is a strict `z.object`: `goal, role?, profileUrl?, cvText?, subject?, anchor?, sourceUrl?`. A `positionId` must be added here.
- `POST /api/runs` (`runs/route.ts:27-92`): bearer → parse → 24 h dedupe on `source_url+goal` → hourly caps → INSERT `investigations(... role, via, profile_url, cv_text)` → `env.RESEARCH_RUN.create({id, params:{runId}})`. Only `runId` is passed to the Workflow; it loads everything from D1 (`load-investigation`, lines 93-100).
- `/api/start` is a wrapper that adds the bearer and `x-oldboys-via: start`; the browser never sees the token.

## Calling an actor outside the Workflow
- `makeActorCall(token)` (`src/adapters/apify.ts:36-69`) is a plain function: raw `fetch` to `POST /v2/acts/{id}/runs?timeout&maxTotalChargeUsd&waitForFinish`, polls to terminal, reads ≤ 50 items, returns `cost_usd = usageTotalUsd`. Apify floors `maxTotalChargeUsd` at $0.50. No route handler uses it today, but nothing stops one. `makeLlmCall` likewise.
- `makeFetchJson` / `fetchJson` (`src/adapters/fetch.ts`): 20 s timeout, one retry on 429/503, 160-char body snippet in the error.
- Budget is per run (`ledger_entries` sums). An ingest call made from a route has no `run_id`; it needs its own cost record or a synthetic ledger key.

## Storage and purge
- `sources(id, run_id → investigations, url, actor, fetched_at, excerpt, r2_key, expires_at, identity)`. `expires_at` is written (7 d) but never read.
- Purge is cron `0 3 * * *` → `purgeExpired` (`src/workflow/purge.ts:21-48`), keyed on `investigations.created_at` + `RETENTION_DAYS`; it deletes R2 objects then rows from a fixed table list. **Any new table must be added to that list** or it survives judging.
- D1 access pattern everywhere: `getCloudflareContext().env.DB.prepare().bind().first/all/run`. No repository layer. Loader-function pattern (`audit/load.ts` takes `db: D1Database`) is the testable shape.

## Report page
- `/runs/[id]` → client `RunView` polling `GET /api/runs/:id/state`; `RunState` carries `subject, headline, role, created_at`, not `profile_url`. Header slot: `run-view.tsx:157-167`; "Hiring for" line: `parts.tsx:326`. Interview kit prints `Hiring for: role`.

## Extension
- Posts `{subject, anchor, goal, sourceUrl}` only. Content script matches `linkedin.com/in/*`; no `/jobs/` match, no `tabs` permission. Detecting a LinkedIn Jobs page is a new content script plus manifest change in the `ext` worktree.

## Tests
- Recipe tests use `src/recipe/__tests__/fakes.ts` (`baseContext`, `fakePorts`, `fakeLlm`). Route handlers are not tested; the one testable handler pattern is `webhooks/elevenlabs/handler.ts` (plain function + env object). Domain projections get a Vitest file each (`role-overview.test.ts`).

## Numbers
| File | Lines |
|---|---|
| `src/recipe/goals/hiring.ts` | 50 |
| `src/recipe/step.ts` | 38 |
| `src/recipe/runner.ts` | 125 |
| `src/workflow/research-run.ts` | 290 |
| `src/recipe/seams/role.ts` | 106 |

Free numbers: plan `007` (003 was never used, 006 is the highest), migration `0009`.

## Constraints this imposes on every option
1. The Workflow loads only from D1, so a position must be resolvable from the `investigations` row (either `position_id` FK or pre-filled `questions_json`).
2. Position-conditioned research costs nothing extra if the position stores its must-haves and the insert copies them into `questions_json` (the `role_questions` step is then skipped).
3. Ingest from a URL that needs an Apify actor is a paid call outside any run; it needs its own cost record and a hard cap, and it runs inside a route handler (Workers request limit, 45 s client timeout).
4. The peer's `/roles` pages group by role text. A `positions` table must either feed that projection (join on `position_id`, fall back to `roleKey`) or replace it; two competing lists would confuse the demo.
