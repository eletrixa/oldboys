# 14 — CEO review: position selector as delivered

Reviewer: Fable acting as CEO, 2026-10-09 01:10. Scale 0–5 per judging dimension (brief: value 35, originality 25, end-to-end 20, tech 10, honesty 10). Gate: every dimension ≥ 4.

## Evidence used
- Local D1 after the browser QA: 8 positions, $0.13 total ingest spend, 0 fallback extractions.
- Live Jobs.cz ingest (`/rpd/2001470594`): title, company, location and 5 specific must-haves (FastAPI/SQLAlchemy, RAG/LLM evaluation, team lead of ~11, AWS/Terraform, Czech C2) read from the page in one Opus call.
- Live run `a0ec24b1` (preview Worker, Josef Buryan for the Acme backend position): done in 2 min 56 s, $0.19, 16 source calls, 4 LLM calls, **no `role_questions` call**; claims landed on `mh-backend-experience` and `mh-technical-leadership`; run page shows "Researched for: Senior Backend Engineer (Node.js)" linking to the position.
- Same person's CMO run `14931ba7`: 100 % claim-text delta and 6 of 9 question ids differ (E3 gate ≥ 30 %: pass).
- `pnpm check` 771 tests green after the second origin merge; root Playwright 2 specs green before the accounts change (being re-pointed at sessions).

## Scores
| Dimension | Score | Why |
|---|---|---|
| Value (35) | 4 | A recruiter now starts from the job, not from a name: paste or link the posting, get must-haves once, research every candidate against the same bar, see them side by side. The coverage table per position is the artefact a hiring manager actually reads. Missing for a 5: no candidate-to-candidate comparison beyond the table, no reuse of a position across organizations. |
| Originality (25) | 4 | Position-conditioned research within one goal is a second axis of "different goal, different substance", and the sourced must-haves (quote-bearing excerpt, editable, extraction provenance stored) are not a dropdown. A 5 would need the extension capturing the posting from the LinkedIn Jobs tab. |
| End-to-end (20) | 4 | Paste → position → research → report → table works live, including a real board (Jobs.cz) and a real run. LinkedIn Jobs URLs still need paste (egress unverified), StartupJobs has no path. |
| Tech (10) | 4 | Pure seams with fixtures (plan, parse, strip, extract), one table + one FK, shared `startRun`, budget cap per ingest, purge by `expires_at`, strict lint, 170+ new tests. Two merges with peers landed without regressions. |
| Honesty (10) | 5 | Fallback and hand edits are recorded in `positions.extraction` and shown; the Jobs.cz JSON-LD claim from research was corrected after a live check; spend is in the ledger and the manual-runs log; no recruiter tested it and the README says so. |

**Weighted: 4.2 / 5. Gate passed.**

## Gaps carried forward (not blocking)
1. LinkedIn Jobs guest fetch from the Worker and Apify memo23 behind `POSITION_INGEST_USD` (needs the egress probe).
2. Extension capture on `linkedin.com/jobs/view/*`.
3. Positions are team-shared; organization scoping when accounts settle.
4. Coverage table column headers show the full question text; must-have titles would read better.
