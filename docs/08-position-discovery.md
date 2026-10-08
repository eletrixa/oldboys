# 02 — Discovery plan: position selector

**Date**: 2026-10-08
**Product stage**: existing (hackathon build, hiring goal live, plans/006)
**Discovery question**: Does a position database with posting links and pre-filled research make a recruiter's loop (pick position → open posting → research a candidate) faster and the report more role-specific, at a cost the budget rules allow?

## Ideas carried forward
1. Position as first-class object (`positions`, `postings`, `investigations.position_id`).
2. Posting ingest from a URL (actor fetch + LLM extract of must-haves and family).
3. Pre-filled start form and "open posting / search people" links.
4. Position-conditioned questions in the hiring recipe.
5. Deterministic title clustering into families, LLM only on residue.

## Assumptions

| # | Assumption | Category | Impact | Uncertainty | Priority |
|---|---|---|---|---|---|
| A1 | The recruiter has a posting URL at hand when they start (not just a title) | Value | H | M | 1 |
| A2 | LinkedIn Jobs, Jobs.cz and StartupJobs posting pages are fetchable by an existing Apify actor or plain fetch inside 45 s | Feasibility | H | H | 1 |
| A3 | Must-haves extracted from a posting change the report substance (claim delta ≥ 30 % between two positions for the same candidate) | Value | H | M | 2 |
| A4 | Title normalisation by rule covers ≥ 80 % of Czech/English postings; LLM residue stays small | Feasibility | M | M | 3 |
| A5 | A pre-filled form with one remaining field (candidate URL) is understood without instructions | Usability | M | L | 4 |
| A6 | Per-position storage of posting text is "public data" under the brief and purgeable after judging like other raw payloads | Viability | H | L | 2 |
| A7 | Position pages and the selector can be built as Next.js server components reading D1 without a new binding | Feasibility | M | L | 5 |
| A8 | Judges read "position" as originality and value, not as scope creep away from "deep research on a person" | Viability | H | M | 2 |
| A9 | A LinkedIn people-search deep link (`/search/results/people/?keywords=…`) is enough of an "open and search" step; no scraping of search pages is needed | Feasibility | M | L | 4 |
| A10 | Family clustering is useful to the recruiter beyond grouping the selector (e.g. shared must-haves) | Value | L | H | 6 |

**Leap-of-faith assumptions**: A2 (can we fetch postings at all), A3 (the position changes the report), A8 (it reads as value, not drift).

## Experiments

| # | Tests | Method | Success criteria | Effort | When |
|---|---|---|---|---|---|
| E1 | A2 | Spike: fetch one posting from each board with `apify/website-content-crawler` and with raw `fetch`; record status, ms, text length | 3 of 4 boards return title + description in < 45 s | 1 h | first |
| E2 | A4 | Unit test over 40 real titles (CZ + EN) through the rule normaliser | ≥ 32 map to a family without LLM | 1 h | first |
| E3 | A3 | Run the same candidate for two positions (e.g. Senior Backend Engineer vs CMO) with must-haves injected into `role_questions`; diff claims | ≥ 30 % claim delta, gaps differ | 1.5 h | after E1 |
| E4 | A1, A5 | Hallway test with one recruiter persona (teammate): give a posting URL, time to first run started | < 90 s, no question asked | 20 min | after UI |
| E5 | A8 | Rehearse the 90 s demo with "position" as the opener; ask a mentor whether it still reads as deep research | Mentor confirms; no "where is the research?" | 15 min | before freeze |
| E6 | A6 | Read brief hard rules against storing posting text; set `expires_at` on posting sources like other sources | Written yes in the dossier | 10 min | first |

## Experiment details

**E1 posting fetch spike.** Hypothesis: posting pages are static enough for a crawler. Setup: `wrangler dev`, call the crawler with `maxCrawlPages 1`, `maxTotalChargeUsd 0.02`. Measure: HTTP status, ms, characters, whether title/company/location are in the text. Decision: a board that fails goes behind a "paste the posting text" fallback, labeled as such; no MOCK.

**E2 normaliser test.** Hypothesis: a rule table handles seniority words (junior/senior/lead/principal, "senior/ka"), level suffixes (I/II/III), locale markers (m/ž, (m/w/d)), and CZ↔EN synonyms (vývojář ↔ developer, obchodník ↔ sales). Decision: under 80 % → add an LLM `classify` seam with a fixed family enum; the rule table stays as the first pass.

**E3 goal-delta within hiring.** Reuses the E3 gate from CLAUDE.md. Decision: under 30 % → must-haves are not reaching the extract/synthesize prompts; fix the seam before building the selector UI.

**E4 and E5** are demo-day checks; they decide copy and the order of the video, not the architecture.

## Timeline (hackathon hours, not weeks)
- Hour 0–1: E1, E2, E6 in parallel (spike, test, rule check).
- Hour 1–3: migration + position model + ingest route; E3.
- Hour 3–5: selector page, pre-filled form, posting links; E4.
- Before freeze: E5.

## Decision framework
- E1 succeeds for ≥ 3 boards → build ingest-from-URL; otherwise ingest-from-pasted-text with URL as metadata.
- E3 ≥ 30 % → position-conditioned questions are in the demo; otherwise the position stays metadata and the demo opener is "pick position, open posting, start".
- E2 < 80 % → LLM classify seam with fixed enum, logged in the ledger as `kind = llm`.
- A10 is not tested now; families stay a grouping key only.
