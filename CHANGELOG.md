# Changelog

All notable changes to oldboys are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed
- Profile hardened: personality only from the person's own writing (types hidden under 3 lines), FACT lines only with a checked quote and per-section counts of dropped lines, a fixed sorted trait list per role (max 10, run's role plus 2 adjacent), one retry over the 40 strongest sources before the profile degrades, and prompts that forbid score, rating, trust and culture-fit wording.
- Enriched profile on the report page follows the approved prototype, kept compact: a summary box (current role, sources, fact and inference counts, run's role fit with must-haves evidenced, risks and questions) with a FACT / INFERENCE legend and section links; numbered sections with a one-line intro; achievements and risks side by side, 3 visible each, with detail lines; evidence lines show FACT or INFERENCE, Supports / Contradicts / Context, the quote, a numbered source opened at the quote and a note, and the summary counts contradicting lines; 5 jobs with dates, duration and location, then education, projects and community collapsed; working style with a disclaimer banner, DISC and MBTI with a confidence word, our read capped at 3 sentences and trait rows with quotes; position fit cards per role and a weighted capability table, fit = sum(weight x status) / sum(weight) computed on the page; 5 questions visible, each with what it closes; a numbered sources list with retrieved dates; lines dropped by the quote check are counted per section.
- Claim extraction output cap raised to 32k tokens: a full-profile brief (17 questions, ~100 sources) truncated at 8k and produced no claims.
- A given LinkedIn profile or CV settles identity: the run no longer pauses to ask "is this them?" when a merged profile exists; other possible matches stay unverified and are shown read-only.

### Added
- Hiring briefs carry an enriched profile: achievements, risks, dated history, a personality read (DISC and MBTI with confidence, inferred from the person's own writing), fit for the role and 2-3 adjacent roles, and interview questions. Every line cites a verbatim quote checked against its source; unsupported lines are dropped. Two extra model calls per hiring run.
- Report page shows the enriched hiring profile above the findings: achievements, risks, history timeline, personality read (DISC and MBTI, labelled as inference from public writing), position fit per role with a trait checklist, and what to ask; every item has an "Evidence (N)" list with the quote, FACT or INFERENCE, supports or weakens, and a link that opens the source at the quote.
- Hiring brief as a full profile: new evidence-backed sections for employer context, education, writing and publications, press coverage, social presence (confirmed profiles listed even without claims), and community and awards; new sources: LinkedIn posts (`harvestapi/linkedin-profile-posts`), the current employer's LinkedIn company page, public Facebook pages (`apify/facebook-pages-scraper`) and a press, awards and community web search.
- Position selector ([plans/007-position-selector/](plans/007-position-selector/)): `/positions` lists positions by family with posting links, `/positions/new` ingests a posting from pasted text or a URL (Jobs.cz, Greenhouse, Lever, Ashby, JSON-LD) and extracts up to five must-haves once, `/positions/<id>` shows the posting, a LinkedIn people-search link, editable must-haves and the coverage table of its runs; "Research a candidate" pre-fills the start form and every run started from a position gets the same questions. Migration `0011_positions.sql`; var `POSITION_INGEST_USD`; `pnpm e2e` root Playwright smoke.
- Profile-first start: candidate search from LinkedIn profile URL or pasted CV, plus role ([plans/006-profile-first/](plans/006-profile-first/))
- Seed profile step to extract name, location, and LinkedIn from the given input
- Role overview page (`/roles` and `/roles/<key>`) listing runs and must-have criteria coverage per role
- GDPR audit record per run: full transparency on data sources, processing, timing, cost, and retention (idea #17)
- Evidence on click (idea #5): every brief claim has a "Show evidence" panel with the verbatim quote, an "Open at the quote" link that opens the source scrolled to and highlighting the quote (Text Fragment, Chromium browsers), the retrieval date, why the source is confirmed as the candidate's, and the saved text around the quote with the match marked (kept until the 7-day purge); inline source links open at the quote and show the retrieval date on hover; the interview kit lists the quote and retrieval date under each sourced claim. `GET /api/runs/:id/state` adds `fetched_at` / `expires_at` per source and `quote_contexts` (never whole excerpts; Art. 9 surroundings dropped)
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
- Claim extraction output cap raised to 32k tokens: a full-profile brief (17 questions, ~100 sources) truncated at 8k and produced no claims.
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
