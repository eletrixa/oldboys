# 03 — Pre-mortem: position selector

**Date**: 2026-10-08 · **Status**: draft · Frame: it is sunrise, the position selector shipped, and the demo lost points. Why?

## Risk summary
- Tigers: 7 (3 blocking, 3 fast-follow, 1 track)
- Paper tigers: 4
- Elephants: 3

## Launch-blocking tigers
| # | Risk | Likelihood | Impact | Mitigation | Deadline |
|---|---|---|---|---|---|
| T1 | LinkedIn Jobs posting pages return a login wall or 999 to the crawler; the demo shows an ingest that fails live | H | H | E1 spike first; ingest accepts pasted posting text as the primary path and URL as metadata; LinkedIn Jobs via `harvestapi/linkedin-job-scraper` or equivalent paid actor only if the spike passes | hour 1 |
| T2 | Scope drift: the selector, clusters, ingest and pipeline view eat the hours and the person report regresses | H | H | Ship in the order of docs/08-position-discovery.md; each slice behind `pnpm check`; the person report stays the demo climax; pipeline view and company import are explicitly deferred | every slice |
| T3 | Position must-haves never reach the LLM seams, so the position is cosmetic and judges see "a dropdown" | M | H | E3 goal-delta test is a gate before UI work; `role_questions` reads `position.must_haves` and the ledger shows them | hour 3 |

## Fast-follow tigers
| # | Risk | Likelihood | Impact | Planned response |
|---|---|---|---|---|
| T4 | Migration `0009` added in a PR but remote D1 not migrated before CI deploys; prod 500s on `/positions` | M | H | PR says "adds migration"; Robert runs `pnpm db:migrate:remote` before merge (CLAUDE.md gotcha); route tolerates a missing table with a plain error page |
| T5 | Family clustering splits obvious siblings ("Backend Developer" vs "Vývojář backendu") and the selector looks broken | M | M | Rule table with CZ/EN synonyms and a 40-title Vitest fixture; a position can be re-parented by hand (`PATCH /api/positions/:id`) |
| T6 | Posting text stored in R2/D1 is forgotten at purge time | L | M | Postings are `sources` rows with `expires_at`; the same purge covers them |

## Track tigers
- T7 Budget: ingest adds one paid actor run per posting outside any research run. Trigger: ledger shows ingest runs without a `run_id`. Response: ingest rows carry `position_id` and their own `cost_usd` in a `position_ledger` or the existing ledger with a synthetic run id.

## Paper tigers
- **"Positions need their own planner/Workflow."** No. Ingest is one actor call plus one LLM extract; a route handler within the 30 s Worker limit suffices if the actor call is bounded by the 45 s client timeout and `waitUntil`. Would become real only if company-wide import (many postings) is added.
- **"Clusters need embeddings / a vector index."** A few dozen positions per demo tenant; a rule table and a fixed family enum are enough. Real only beyond hundreds of positions.
- **"Pre-filled form breaks the extension contract."** The extension keeps posting `{subject, anchor, goal, sourceUrl}`; `position_id` is optional on `StartRunBody`.
- **"Deep-linking LinkedIn people search is scraping."** It is a URL the recruiter opens in their own browser; no automation, no data pulled.

## Elephants
1. **The brief is "deep research on a person"; positions are recruiting-tool territory.** A judge may ask what this has to do with identity resolution and sourced claims. The honest answer: the position is the *goal* made concrete, and it must visibly change the report. If E3 fails, the selector should not be in the 90 s video.
2. **Two sessions edit the main checkout** (memory: shared checkout). A migration plus route plus recipe change across three files invites merge pain. Take the plan/migration numbers now (007, 0009; 0008 went to a peer) and keep the diff to new files plus one FK.
3. **Nobody is the recruiter.** Every "the recruiter will…" is a guess by two engineers. E4 with a teammate is the only user test before freeze; say so in the honesty section of the README.

## Go / no-go checklist
- [ ] E1 spike result recorded (which boards fetch, which fall back to paste)
- [ ] E3 claim delta ≥ 30 % with must-haves injected
- [ ] Migration noted in PR; remote migrate before merge
- [ ] `pnpm check` green on each slice
- [ ] Rollback: feature is additive; `position_id` nullable; the old start form path untouched
- [ ] README honesty section mentions no real recruiter test
