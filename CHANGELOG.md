# Changelog

All notable changes to oldboys are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Apply page CV uploader (`/apply/<tag>`): PDF, Word (.docx) or text up to 10 MB, or pasted CV text; one drop zone that is also the browse button, instant type and size check, upload progress, "Try again" that keeps the draft, and a done card naming the reply address and what was attached. DOCX text is read with `mammoth`.
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
- Nightly purge: intake applications (rows and R2 CV files) are deleted after 7 days and before the runs they started, so `applications.run_id` never blocks the runs sweep; the purge result reports `applications`
- Extract and synthesize steps now degrade gracefully instead of failing, producing evidence-only briefs and completed runs
- Resolve fallback no longer merges on name text alone; uses URL anchor (0.6) or cross-link only, drops PDF/genealogy noise
- Collectors that make no request (budget or no confirmed handle) record "not searched: &lt;why&gt;" gaps
- Source identity properly set via `identityFor` for all collectors; unverified for name-search and SERP hits
- Answer errors in the lineup are retried automatically
- Brief display defends against missing `degraded` and `evidence` fields
||||||| fc92ebf
