---
spec: positions-pages
status: draft
plan: 007
created: 2026-10-08
---
# positions-pages

## Intent
The recruiter-facing selector: pick or add a position, open its posting, find people, and start candidate research with the must-haves pre-filled.

## Contract
Client pages follow `src/app/roles/roles-view.tsx`: operator token asked once, kept in `sessionStorage` under the same key (`oldboys.runToken`), sent as `Authorization: Bearer`. Extract the shared token helpers (`readToken`, `writeToken`, `TokenForm`) and `RoleTable` plus `DISCLAIMER` from `roles-view.tsx` into `src/app/_components/` and import them in both views; do not copy them. Pure logic lives in testable functions; the views are thin.

Files: `src/app/positions/page.tsx`, `positions-view.tsx`; `src/app/positions/new/page.tsx`, `new-position-form.tsx`; `src/app/positions/[id]/page.tsx`, `position-detail.tsx`; `src/domain/position-links.ts` (pure helpers: `groupByFamily`, `filterPositions`, `linkedinPeopleSearchUrl`, `researchHref`, `ingestLabel`, `isFallbackMustHaves`, `buildCreateBody`, `addMustHave`, `removeMustHave`), `src/app/positions/{use-authed-json.ts,auth-states.tsx,patch-position.ts,must-have-editor.tsx,position-basics.tsx}`, `src/app/_components/{token.ts,token-form.tsx,role-table.tsx}`; changes in `src/app/page.tsx`, `src/app/start-form.tsx`, `src/app/runs/[id]/` header. Tests: `src/domain/__tests__/position-links.test.ts` (all pure helpers including `groupByFamily`), component tests with Testing Library only if the repo already has them (check `package.json`); otherwise the e2e spec covers the views.

### Pure helpers
- `groupByFamily(items)`: groups list items into sections in the fixed `FAMILIES` order, skipping empty families, `other` last; inside a section newest first.
- `filterPositions(items, query)`: case-insensitive, diacritics-insensitive substring match on title and company; empty query returns all.
- `linkedinPeopleSearchUrl(title, location?)`: `https://www.linkedin.com/search/results/people/?keywords=` + `encodeURIComponent("<title> <location>")` (location omitted when empty, single space otherwise, trimmed).
- `researchHref(id)`: `/?positionId=<encodeURIComponent(id)>`.

### /positions
Token form first. Then a search box (filters by title and company as you type) and one section per family, heading is the family name. Each card: title, company, location, run count (`0 runs`, `1 run`, `n runs`), "Open posting" link only when `posting_url` is set (opens in a new tab, `rel="noopener noreferrer"`), and a link to `/positions/<id>`. Empty list: a message with a link to `/positions/new`. A "Add a position" link is always visible.

### /positions/new
Textarea "Posting text" (max 20000), input "Posting URL", optional input "Title". Submit posts to `/api/positions`. On 201 or 200 route to `/positions/<id>` at once; the response `notes` are not shown on this page (the detail page flags fallback must-haves instead). On 4xx show the server's `error` (or the 400 message) inline next to the form and keep the user's input. Submit is disabled while pending and when both text and URL are empty. A 401 returns to the token form.

### /positions/[id]
Header: title, company, location, a family chip, a label for the ingest method (`Pasted`, `Jobs.cz`, `Greenhouse`, `Lever`, `Ashby`, `Posting page`). Actions: "Open posting" (only with `posting_url`), "Search people on LinkedIn" (`linkedinPeopleSearchUrl`, new tab), "Research a candidate" (`researchHref`). Must-haves: list, each with title and text, editable inline (text, title; add up to 5; remove down to 1); "Save" sends `PATCH` with `must_haves` and shows saved or error. Family and title are editable the same way. When the must-haves are exactly the three generic fallback ones (`isFallbackMustHaves`; `ingest_method` does not record this) a note "Fallback must-haves (AI was off)" is shown. Title and family are edited in a collapsed "Edit title and family" block. Below: coverage table for the position's runs using `RoleTable` with the existing disclaimer line ("This table shows how much public evidence the research found, not how good a candidate is."), or "No candidates researched yet." when `group` is null. Unknown id: "Position not found" with a link to `/positions`.

### Home, start form, run page
- `src/app/page.tsx`: the small link text becomes "Positions" and points to `/positions`, replacing the `/roles` link. `/roles` remains reachable by URL and unchanged.
- Start form: when the URL has `?positionId=<id>`, the client form (`useSearchParams`, inside `Suspense`) fetches `GET /api/positions/<id>/summary`, shows "Researching for: <title>" with the must-haves read-only above the fields, hides the role field, disables submit while loading, and posts `positionId` (no `role`) through `src/app/start-body.ts`. If the position cannot be loaded (404 or network), show an inline note and fall back to the normal role field. Without `?positionId=` the form is unchanged.
- `GET /api/positions/:id/summary` (`src/app/api/positions/[id]/summary/`): public, no bearer, so the start page needs no token. Returns `{ id, title, must_haves: [{ id, title?, text }] }` only (no company, posting URL, excerpt or `accepted_evidence`), 404 `{ error }` for an unknown id, `Cache-Control: no-store`. It exposes what the public run page already shows.
- `/api/start` proxy must pass `positionId` through to `/api/runs` (check `src/app/api/start/route.ts`; add the key to its body handling if it filters keys).
- Run page header: when `state.position` is set, show "Researched for: <title>" linking to `/positions/<id>` (`positionHeader` in `src/app/runs/[id]/position-header.ts`); otherwise nothing new. The brief's "Hiring for" line keeps showing the role. The interview kit "Hiring for:" uses `state.position.title` when present, else `state.role` (equal today; the kit no longer depends on that).

## Invariants
- The token never leaves `sessionStorage` except as the Authorization header.
- The coverage table never ranks or scores people; the disclaimer is always rendered with it.
- External links use `rel="noopener noreferrer"`.
- `/positions` makes no request without a token.

## Acceptance
- [ ] G1: `groupByFamily` orders sections by `FAMILIES`, puts `other` last, omits empty families, newest first inside a section.
- [ ] G2: `filterPositions` matches `"data"` against title `"Senior Data Engineer"`, matches company `"Škoda"` with query `"skoda"`, and returns all for `""` and whitespace.
- [ ] G3: `linkedinPeopleSearchUrl("Senior Data Engineer", "Prague")` equals the exact URL with `Senior%20Data%20Engineer%20Prague`; without location there is no trailing `%20`.
- [ ] G4: `linkedinPeopleSearchUrl` encodes `&`, `#` and non-ASCII safely (`C#/.NET & Azure` round-trips through `decodeURIComponent`).
- [ ] G5: `researchHref("abc-1")` is `/?positionId=abc-1`; an id with `&` is encoded.
- [ ] G6: home page source links `Positions` to `/positions` and no longer links `/roles` (assert on the rendered element tree or a source-level test as the repo does for pages).
- [ ] G7: start form with `?positionId` hides the role field, shows the position title and must-haves, and posts `positionId` and no `role` (`buildStartBody`, `src/app/__tests__/start-body.test.ts`).
- [ ] G8: start form without `?positionId` builds the same body as today.
- [ ] G9: the `/api/start` proxy forwards `positionId`: it passes the request text through unchanged and `StartRunBody` accepts the key (covered by `run-body.test.ts` S1; no mapping function exists).
- [ ] G10: `positionHeader` (`position-header.test.ts`) returns `{ label: "Researched for: <title>", href: "/positions/<id>" }` for a state with a position and `null` otherwise.
- [ ] G11: `RoleTable` is imported by both `/roles` and `/positions/[id]` from `src/app/_components/` (no duplicate definition remains in `roles-view.tsx`); the existing roles behaviour is unchanged.
- [ ] G12: new-position form body builder omits empty fields and trims; it returns "nothing to send" when both text and URL are empty.
- [ ] G13: must-have editor helper enforces 1..5 items and `mh-` ids for added items (slug from the title).
- [ ] G14: `GET /api/positions/:id/summary` returns only id, title and must-haves without `accepted_evidence`, needs no token, 404 for an unknown or over-long id (`summary.test.ts`).
- [ ] G15: interview kit "Hiring for:" uses the position title when the run has a position (`interview-kit.test.ts`).
