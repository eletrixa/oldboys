# Changelog

All notable changes to oldboys are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Apply page CV uploader (`/apply/<tag>`): PDF, Word (.docx) or text up to 10 MB, or pasted CV text; one drop zone that is also the browse button, instant type and size check, upload progress, "Try again" that keeps the draft, and a done card naming the reply address and what was attached. DOCX text is read with `mammoth`.
- Apply page round 2: the tab title and link preview name the role and company ("Apply: <role> at <company>", new optional `company` on intake tags, migration `0015_intake_company.sql`), a neutral favicon, a privacy line with a notice page (`/apply/<tag>/privacy`), a Czech version (`?lang=cs`), every invalid field marked in one pass plus blur checks, an older `.doc` kept beside LinkedIn, a scanned PDF without text answered on the spot, and "usually within a week" on the done card.
- Position selector ([plans/007-position-selector/](plans/007-position-selector/)): `/positions` lists positions by family with posting links, `/positions/new` ingests a posting from pasted text or a URL (Jobs.cz, Greenhouse, Lever, Ashby, JSON-LD) and extracts up to five must-haves once, `/positions/<id>` shows the posting, a LinkedIn people-search link, editable must-haves and the coverage table of its runs; "Research a candidate" pre-fills the start form and every run started from a position gets the same questions. Migration `0011_positions.sql`; var `POSITION_INGEST_USD`; `pnpm e2e` root Playwright smoke.
- Profile-first start: candidate search from LinkedIn profile URL or pasted CV, plus role ([plans/006-profile-first/](plans/006-profile-first/))
- Seed profile step to extract name, location, and LinkedIn from the given input
- Role overview page (`/roles` and `/roles/<key>`) listing runs and must-have criteria coverage per role
- GDPR audit record per run: full transparency on data sources, processing, timing, cost, and retention (idea #17)
- GDPR Art. 15 data access export per run (`GET /api/runs/:id/access-export`, link on the audit page): confirmed sources, linked profiles, claims backed only by confirmed sources, the brief text, purpose, legal basis, controller and deletion date; never namesakes, unconfirmed pages or Art. 9 claims
- 30-second summary card above the brief: confirmed platforms, role criteria coverage, top gaps and interview question (idea #15)
- Candidate notice export: polite Markdown copy for the candidate informed under Art. 6(1)(f), with deletion date and correction link (idea #7)
- Interview kit export: Markdown template for the hiring team with role, profile, cost, coverage checklist, sourced answers, and gaps (idea #6)
- Identity map card: SVG visualization of candidate identity merge and namesakes (idea #9)
- Origin-aware section confidence: report sections build confidence based on whether the data came from the candidate or public sources
- Brief polish: short must-have titles, 0.95 confidence cap, canonical source URLs, missing-source claims, plain gap text
- Claim quality: role-bound interview questions, dropped unknown support IDs, hedged alias and homepage screens
- Source deduplication: one source per page, locale and trailing-slash variants are not stored again
- OPENALEX_API_KEY support for OpenAlex API calls

### Changed
- Radar design applied to every page: run page (timeline progress, question card, brief sections, evidence lists), roles overview and table, audit record, start form, not-found and loading states. Shared class vocabulary in `src/app/ui.tsx`, spec in `docs/design/radar-ui.md`; the temporary zinc/teal remap in `globals.css` is gone.
- Brief sections now shown only if content was found; honest gaps for unavailable sections
- Lineup questions ask profile-platform confirmation only (web form handles up to 3)
- Progress indication: step index, step count, and failed-step marking with plain-words reason
- Run state cost and research time now displayed on the run page
- Ledger entries include successful AI model call counts and cost tracking

### Fixed
- Apply page uploader hardening: the send times out only after 90 s without progress, so a 10 MB CV on a slow line finishes; a file dropped on the page in paste mode no longer opens in the tab and loses the draft; several dropped files attach the first usable one and say so; an empty file is refused with a sentence; one send button ("Try again" after a failure) that keeps focus while the fields are locked during the upload; the LinkedIn field is no longer autofilled with a personal site; the honeypot is renamed `hp_contact` with a fill-time check, and a trapped send shows "try again" instead of "Received".
- Apply endpoint: a per-IP limit (`APPLY_RATE_LIMIT` ratelimits binding, 5 sends a minute), a declared Content-Length required before the body is read, a decompression-bomb guard before a .docx or PDF is parsed (`src/domain/cv-inflate.ts`), the file's kind taken from its bytes (a .docx sent as a PDF is read as Word), text files read as UTF-16 by BOM or Czech windows-1250 and binary junk refused, no second parse of an unreadable CV, and a resend with other details noted on the row for the operator.
- CV file names: diacritics folded and the extension kept (`资料.pdf` is stored as `cv.pdf`, not `pdf`).
- Apply page: Try again after a failed or timed-out send no longer shows "Received" while the CV is lost; the funnel marks a failed delivery and the next one resumes it at once (CV stored, run started or linked, a missing Workflow instance created), and a send still in flight answers 503. A double tap sends one request.
- Intake hourly cap: a capped application is stored and acknowledged, never answered with "try again in an hour"; a new quarter-hour cron (`*/15 * * * *`) starts capped runs once the hour has room.
- Nightly purge: intake applications (rows and R2 CV files) are deleted after 7 days and before the runs they started, so `applications.run_id` never blocks the runs sweep; the purge result reports `applications`
- Extract and synthesize steps now degrade gracefully instead of failing, producing evidence-only briefs and completed runs
- Resolve fallback no longer merges on name text alone; uses URL anchor (0.6) or cross-link only, drops PDF/genealogy noise
- Collectors that make no request (budget or no confirmed handle) record "not searched: &lt;why&gt;" gaps
- Source identity properly set via `identityFor` for all collectors; unverified for name-search and SERP hits
- Answer errors in the lineup are retried automatically
- Brief display defends against missing `degraded` and `evidence` fields
