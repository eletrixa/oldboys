# Unit: operator UI (`/intake`, `GET /api/intake/applications`, run banner)

## Files
- `src/app/api/intake/applications/route.ts` (GET, bearer `RUN_TOKEN` like `GET /api/roles`)
- `src/app/intake/page.tsx` (server shell) + `src/app/intake/intake-view.tsx` (client). Token storage, `TokenForm` and the 401-aware `fetchGated` moved out of `roles-view.tsx` into `src/app/_lib/operator-token.tsx`; both views import it (not a hook: roles-view loaded with a plain function, so the shared piece is the same function).
- `src/app/api/intake/tags/route.ts` (GET list, POST create `{tag, role, goal?, startupjobsOfferId?}`; bearer `RUN_TOKEN`) so tags can be created without a SQL console; `src/app/api/intake/tags/tag-body.ts` holds the Zod body and the duplicate classifier; `src/app/intake/tag-form.tsx` small form on the same page. Pure display helpers (labels, row shaping, dates, the run-page line) live in `src/app/intake/intake-rows.ts`. The top nav gains an "Applications" link to `/intake`.
- `src/app/api/runs/[id]/state/route.ts` + `src/app/runs/[id]/state.ts` + `run-view.tsx`: `intake: { source, tag, receivedAt } | null` from `applications` joined on `investigations.application_id`; one line under the heading "From <source> · <tag> · <date>".

## `GET /api/intake/applications`
Last 200 rows: `id, source, external_id, tag, name, email, linkedin_url, cv_key, status, run_id, note, received_at`, newest first. Never returns `cv_text` or `cover_letter` (the table page is a queue, not a dossier).

## `/api/intake/tags`
- `GET` -> `{ tags: [{tag, role, goal, startupjobs_offer_id, created_at}] }`, newest first.
- `POST {tag, role, goal?, startupjobsOfferId?}`: the tag is trimmed and lowercased, then checked against `IntakeTag`; role 1..300; goal `hiring` (default) or `due-diligence`; `startupjobsOfferId` optional, <= 40. `201` with the stored row, `400` invalid body (`parseJsonBody`), `409` when the tag exists or the StartupJobs offer id is already mapped (decided by the D1 UNIQUE constraint, not a pre-check). Both methods need the `RUN_TOKEN` bearer.

## `/intake` page
Columns: received (UTC `YYYY-MM-DD HH:MM`), tag, source, name (email under it), status badge, run link (`/runs/<id>`) when present, note (truncated at 80 characters, full on title). Empty state: "No applications yet. Point a job posting at /apply/<tag> or jobs+<tag>@asajj.cz." Tags section: table + create form. No ranking, no scores.

## Tests
- Pure helpers only (status label and tone, source label, date format, row shaping, the run-page line) in `src/app/intake/__tests__/intake-rows.test.ts`; the tag body schema and duplicate classifier in `src/app/api/intake/tags/__tests__/tag-body.test.ts`. Routes exercised by the QA pass (Playwright) rather than unit tests, like `/api/roles`.
