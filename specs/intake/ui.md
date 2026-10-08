# Unit: operator UI (`/intake`, `GET /api/intake/applications`, run banner)

## Files
- `src/app/api/intake/applications/route.ts` (GET, bearer `RUN_TOKEN` like `GET /api/roles`)
- `src/app/intake/page.tsx` (server shell) + `src/app/intake/intake-view.tsx` (client; token handling copied from `src/app/roles/roles-view.tsx`, extract the shared token hook into `src/app/_lib/use-operator-token.ts` if roles-view's is reusable as-is)
- `src/app/api/intake/tags/route.ts` (GET list, POST create `{tag, role, goal?, startupjobsOfferId?}`; bearer `RUN_TOKEN`) so tags can be created without a SQL console; `src/app/intake/tag-form.tsx` small form on the same page.
- `src/app/api/runs/[id]/state/route.ts` + `src/app/runs/[id]/state.ts` + `run-view.tsx`: `intake: { source, tag, receivedAt } | null` from `applications` joined on `investigations.application_id`; one line under the heading "From <source> · <tag> · <date>".

## `GET /api/intake/applications`
Last 200 rows: `id, source, external_id, tag, name, email, linkedin_url, cv_key, status, run_id, note, received_at`, newest first. Never returns `cv_text` or `cover_letter` (the table page is a queue, not a dossier).

## `/intake` page
Columns: received, tag, source, name (email under it), status badge, run link (`/runs/<id>`) when present, note (truncated, full on title). Empty state: "No applications yet. Point a job posting at /apply/<tag> or jobs+<tag>@asajj.cz." Tags section: table + create form. No ranking, no scores.

## Tests
- Pure helpers only (status label, row shaping) in `src/app/intake/__tests__/`. Routes exercised by the QA pass (Playwright) rather than unit tests, like `/api/roles`.
