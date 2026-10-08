# 01 — Brainstorm: position selector and position clusters

**Mode**: ideas, existing product (oldboys, hiring goal, plans/006 profile-first start).
**Context**: Today a recruiter pastes one LinkedIn URL or CV plus a free-text role. There is no notion of "the position we are filling", so runs are orphans: nothing links a run to the job posting, to sibling candidates, or to the questions the role really needs. The idea: a position database (clustered into families), each position linked to its postings (LinkedIn Jobs, Jobs.cz, StartupJobs, Welcome to the Jungle, company career page) and to its research runs. The recruiter opens the site, picks a position, jumps to the live posting, and starts research with the role pre-filled.

## PM perspective
1. **Position as the first-class object** — `positions` table (title, family, seniority, location, must-haves, postings[], runs[]). Every run carries `position_id`; the report page shows siblings. | Impact: H | Effort: M
2. **Posting ingest from a URL** — paste a LinkedIn Jobs / Jobs.cz / StartupJobs URL; one Apify actor fetches title, company, location, description; the LLM extracts must-haves and maps the posting to a family. | Impact: H | Effort: M
3. **Position-conditioned questions** — the hiring recipe's `role_questions` step reads the position's must-haves instead of a free-text role, so two positions yield different reports for the same candidate (the "goal delta" judges reward, applied within hiring). | Impact: H | Effort: S
4. **Pipeline view per position** — all candidates researched for a position, ranked by coverage and FACT count, never by a trust score. Gaps per candidate side by side. | Impact: M | Effort: M
5. **Company-wide position import** — crawl a company careers page (website-content-crawler) and create every open position in one go; the recruiter curates. | Impact: M | Effort: M

## Designer perspective
1. **Selector as a two-level picker** — family (Engineering, Marketing, Sales, Ops) then position, with a search box; a position card shows posting badges (LinkedIn, Jobs.cz…) as outbound links. | Impact: M | Effort: S
2. **"Open and search" button** — the card deep-links to the posting and to a pre-built LinkedIn people search (`title + location`) so the recruiter lands on candidates, then uses the extension to send one back. | Impact: H | Effort: S
3. **Pre-filled start form** — choosing a position pre-fills role, location anchor and must-haves; the recruiter only pastes the candidate URL. | Impact: H | Effort: S
4. **Position header on the report** — the report page states "researched for: Senior Backend Engineer @ X, posting #123" with a link; the brief becomes shareable with the hiring manager. | Impact: M | Effort: S
5. **Empty-state onboarding** — first visit offers "paste a posting URL" as the single CTA; no empty table. | Impact: M | Effort: S

## Engineer perspective
1. **Deterministic clustering first** — normalise title (strip seniority, level, location, gendered forms, CZ/EN synonyms) with a rule table; LLM only on the residue. Reproducible, testable, cheap. | Impact: M | Effort: S
2. **Extension writes the position too** — the extension already sends `sourceUrl`; on a LinkedIn Jobs page it can send `postingUrl` and create/attach the position without leaving LinkedIn. | Impact: H | Effort: M
3. **Postings as Sources** — reuse the `sources` table and R2 for raw posting payloads; the position's must-haves are claims with quotes, so the posting is sourced like everything else. | Impact: M | Effort: S
4. **Family embeddings in D1** — store a Workers AI embedding per position for nearest-family lookup; avoids a second LLM call on every ingest. | Impact: L | Effort: M
5. **Position-scoped budget** — budget ledger aggregates per position so the recruiter sees total spend per hire. | Impact: L | Effort: S

## Top 5
| Rank | Idea | Why | Quick win? |
|---|---|---|---|
| 1 | Position as first-class object (PM1) | Everything else hangs off it; one migration and one FK on `investigations` | yes |
| 2 | Posting ingest from URL (PM2) | Turns the database from manual typing into one paste; uses the existing actor + extract seam | yes |
| 3 | Pre-filled start form + "open and search" (D2, D3) | The literal user story: pick, open, start | yes |
| 4 | Position-conditioned questions (PM3) | Converts the position into report substance, not metadata; judges score value and goal-delta | yes |
| 5 | Deterministic clustering with LLM residue (E1) | Families without an embedding store; testable in Vitest | yes |

Deferred: company-wide import (PM5), pipeline ranking view (PM4), extension posting capture (E2), embeddings (E4).

## Assumptions to validate
- A recruiter works from a posting URL, not from a title typed by hand.
- Posting pages on LinkedIn Jobs and Jobs.cz are fetchable by an existing Apify actor within the 45 s timeout.
- Position families can be derived mostly by rule; the LLM residue is under 20 %.
- The hiring recipe's `role_questions` step can take structured must-haves instead of a string without widening the step file past 150 lines.
