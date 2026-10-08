# Changelog

All notable changes to oldboys are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Add a position from a link, automatically: `/positions/new` opens on a "From a link" tab; StartupJobs offers (`startupjobs.cz/nabidka/<id>`) and Jobs.cz company career sites (`<company>.jobs.cz`, the target of most `jobs.cz/rpd/<id>` links, read through the site's public widget API) join the fetched boards, so title, company, location and must-haves come from the posting. Re-adding the same StartupJobs or Jobs.cz ad reuses the stored position. A "By hand" tab adds a position from a title alone (company, location and posting text optional); without text it gets three generic must-haves to edit.
- CV consistency check (idea #14): runs started from a CV get a "CV vs public record" section that labels each concrete CV statement (employer, role and dates, projects, education) as "Matches public record", "Differs — ask, don't assume" or "Not found publicly"; each difference becomes a neutral interview question and a to-verify item (so the phone proposal and interview kit pick it up), the 30-second summary adds "CV: N match, M to ask about", and the section confidence rates how well the CV could be checked, never the candidate. Runs without a CV are unchanged; the CV excerpt read by extract grows from 2000 to 8000 characters
- Profile suggestions on the start form ([plans/011-profile-suggest/](plans/011-profile-suggest/)): type a candidate's name (plus an optional company or city), press "Find profiles", and pick one of up to eight public LinkedIn profiles found via web search (`GET /api/profiles/suggest`, Brave Search `site:linkedin.com/in`, never linkedin.com itself); a pasted URL still works as before. Optional secret `BRAVE_SEARCH_KEY` (without it the field behaves as before); 60 lookups per account per hour; migration `0014_suggest_attempts.sql`.
- After the interview (idea #23): paste the filled interview kit back on the run page to see answered / verified counts and the points still open, with "Copy open points"; ticked boxes or written notes count as answered, the notes are never read or scored and never leave the browser
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
- Verification calls now dial from a Twilio US number (+1 443 316 2585) instead of the Czech verified caller ID, which Czech carriers reject as spoofed; `RUN_CALL_MAX` raised from 2 to 3 calls per run; the ElevenLabs webhook now also sends `call_initiation_failure` so busy / no-answer reaches the app immediately
- Phone verification on the run page uses the login session instead of the team token: the call panel no longer asks for `RUN_TOKEN` and shows "Your login has expired. Log in again." on a 401; `POST /api/runs/:id/calls`, `POST /api/calls/:id/approve` and `/skip` and `GET /api/roles` accept a session or the bearer, `POST /api/runs` stays bearer-only
- Radar design applied to every page: run page (timeline progress, question card, brief sections, evidence lists), roles overview and table, audit record, start form, not-found and loading states. Shared class vocabulary in `src/app/ui.tsx`, spec in `docs/design/radar-ui.md`; the temporary zinc/teal remap in `globals.css` is gone.
- Brief sections now shown only if content was found; honest gaps for unavailable sections
- Lineup questions ask profile-platform confirmation only (web form handles up to 3)
- Progress indication: step index, step count, and failed-step marking with plain-words reason
- Run state cost and research time now displayed on the run page
- Ledger entries include successful AI model call counts and cost tracking

### Fixed
- Phone verification proposal never reads internal gap reasons to the candidate: a source gap becomes a question only when it is a plain "no … found" statement (scrubbed of links, e-mails and numbers); failed requests (URLs, HTTP codes), budget, fallback and namesake-only gaps are no longer asked about
- Nightly purge: intake applications (rows and R2 CV files) are deleted after 7 days and before the runs they started, so `applications.run_id` never blocks the runs sweep; the purge result reports `applications`
- Extract and synthesize steps now degrade gracefully instead of failing, producing evidence-only briefs and completed runs
- Resolve fallback no longer merges on name text alone; uses URL anchor (0.6) or cross-link only, drops PDF/genealogy noise
- Collectors that make no request (budget or no confirmed handle) record "not searched: &lt;why&gt;" gaps
- Source identity properly set via `identityFor` for all collectors; unverified for name-search and SERP hits
- Answer errors in the lineup are retried automatically
- Brief display defends against missing `degraded` and `evidence` fields
||||||| fc92ebf
