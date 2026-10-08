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

Files: `src/app/positions/page.tsx`, `positions-view.tsx`; `src/app/positions/new/page.tsx`, `new-position-form.tsx`; `src/app/positions/[id]/page.tsx`, `position-detail.tsx`; `src/app/positions/position-links.ts` (pure helpers); changes in `src/app/page.tsx`, `src/app/start-form.tsx`, `src/app/runs/[id]/` header. Tests: `src/app/positions/__tests__/position-links.test.ts`, `groupByFamily` in `src/domain/__tests__/position-overview.test.ts`, component tests with Testing Library only if the repo already has them (check `package.json`); otherwise the e2e spec covers the views.

### Pure helpers
- `groupByFamily(items)`: groups list items into sections in the fixed `FAMILIES` order, skipping empty families, `other` last; inside a section newest first.
- `filterPositions(items, query)`: case-insensitive, diacritics-insensitive substring match on title and company; empty query returns all.
- `linkedinPeopleSearchUrl(title, location?)`: `https://www.linkedin.com/search/results/people/?keywords=` + `encodeURIComponent("<title> <location>")` (location omitted when empty, single space otherwise, trimmed).
- `researchHref(id)`: `/?positionId=<encodeURIComponent(id)>`.

### /positions
Token form first. Then a search box (filters by title and company as you type) and one section per family, heading is the family name. Each card: title, company, location, run count (`0 runs`, `1 run`, `n runs`), "Open posting" link only when `posting_url` is set (opens in a new tab, `rel="noopener noreferrer"`), and a link to `/positions/<id>`. Empty list: a message with a link to `/positions/new`. A "Add a position" link is always visible.

### /positions/new
Textarea "Posting text" (max 20000), input "Posting URL", optional input "Title". Submit posts to `/api/positions`. On 201 or 200 route to `/positions/<id>`. On 4xx show the server's `error` (or the 400 message) inline next to the form and keep the user's input. Submit is disabled while pending and when both text and URL are empty. A 401 returns to the token form.

### /positions/[id]
Header: title, company, location, a family chip, a label for the ingest method (`Pasted`, `Jobs.cz`, `Greenhouse`, `Lever`, `Ashby`, `Posting page`). Actions: "Open posting" (only with `posting_url`), "Search people on LinkedIn" (`linkedinPeopleSearchUrl`, new tab), "Research a candidate" (`researchHref`). Must-haves: list, each with title and text, editable inline (text, title; add up to 5; remove down to 1); "Save" sends `PATCH` with `must_haves` and shows saved or error. Family and title are editable the same way. Below: coverage table for the position's runs using `RoleTable` with the existing disclaimer line ("This table shows how much public evidence the research found, not how good a candidate is."), or "No candidates researched yet." when `group` is null. Unknown id: "Position not found" with a link to `/positions`.

### Home, start form, run page
- `src/app/page.tsx`: the small link text becomes "Positions" and points to `/positions`, replacing the `/roles` link. `/roles` remains reachable by URL and unchanged.
- Start form: when the URL has `?positionId=<id>`, fetch the position (through the same-origin route the form already uses for authenticated calls, or the token form if the repo's start path requires it; keep whatever `/api/start` does for the bearer) and show its title and must-haves read-only, hide the role field, and include `positionId` in the POST body. If the position cannot be loaded, show an inline error and fall back to the normal role field. Without `?positionId=` the form is unchanged.
- `/api/start` proxy must pass `positionId` through to `/api/runs` (check `src/app/api/start/route.ts`; add the key to its body handling if it filters keys).
- Run page header: when `state.position` is set, show "Researched for: <title>" linking to `/positions/<id>`; otherwise nothing new. Interview kit "Hiring for:" already uses `state.role`, which equals the position title; add no code, but keep the existing test.

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
- [ ] G7: start form with `?positionId` hides the role field, shows the position title and must-haves, and posts `positionId` and no `role` (test the pure body builder extracted from the form).
- [ ] G8: start form without `?positionId` builds the same body as today.
- [ ] G9: the `/api/start` proxy forwards `positionId` (test the body-mapping function).
- [ ] G10: run page header helper returns `{ label: "Researched for: <title>", href: "/positions/<id>" }` for a state with a position and `null` otherwise.
- [ ] G11: `RoleTable` is imported by both `/roles` and `/positions/[id]` from `src/app/_components/` (no duplicate definition remains in `roles-view.tsx`); the existing roles behaviour is unchanged.
- [ ] G12: new-position form body builder omits empty fields and trims; it returns "nothing to send" when both text and URL are empty.
- [ ] G13: must-have editor helper enforces 1..5 items and `mh-` ids for added items (slug from the title).
