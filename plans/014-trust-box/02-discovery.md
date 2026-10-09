# Discovery plan: Trust box

**Date**: 2026-10-09
**Product stage**: existing
**Discovery question**: Does a recruiter get more from a box that scores the *evidence* than from one that scores the *person*, and can a jury tell the difference?

## Ideas carried forward
A. Evidence confidence figure (report-level). B. Identity strip (label). C. Checks ledger (counts + Ask/Check). D. Person trust score (kept only as the control to argue against).

## Assumptions
| # | Assumption | Category | Impact | Uncertainty | Priority |
|---|---|---|---|---|---|
| 1 | Recruiters read "trust" as "can I rely on this brief", not "is this person honest" — if not, any figure in a box named Trust is misread | Value | H | H | 1 |
| 2 | A jury reads a report-level evidence figure as honesty, not as a dressed-up person score | Viability | H | M | 2 |
| 3 | The identity label from `resolve.ts` corroboration matches what the recruiter would decide from the lineup | Value | M | M | 4 |
| 4 | `claims` + verify rows + `challenge_summary` are enough to compute the figure for old runs (no migration) | Feasibility | M | L | 5 |
| 5 | Counts in the Checks ledger (CV differs 1, registry records 0) do not get summed by the reader into a mental score | Usability | M | M | 3 |
| 6 | A person trust score would cost honesty points and raise Art. 22 (automated profiling) questions | Viability | H | L (confident it would) | — |
| 7 | Two figures on one page (fit % from 013, evidence % here) are not confused | Usability | M | M | 3 |

Leap-of-faith: #1 and #2. #6 is treated as settled by the brief.

## Experiments
| # | Tests | Method | Success | Effort | When |
|---|---|---|---|---|---|
| E1 | #1, #5, #7 | Static mock of the profile page with the three-strip box; 3 recruiters (Robert's network) think aloud: "what does 78 mean?" | ≥2 of 3 say "how much evidence / how sure the report is", none say "how honest the person is" | 2 h | day 1 |
| E2 | #2 | Jury dry run: give the mock and `docs/brief.md` to a cold reviewer (fresh agent or colleague) asked to score honesty 0–5 and name the risk | Honesty ≥4, no "trust score of a person" flagged | 1 h | day 1 |
| E3 | #3 | Replay 5 local QA runs (Robert, Minas, 3 eval subjects): compare the label to the lineup answers recorded in `eval/results.json` | Label agrees on ≥4 of 5 | 1 h | day 1 |
| E4 | #4 | Spike: compute the figure from `RunState` on the oldest remote run with no `challenge_summary` | Non-null figure or a clean "not available" | 30 min | day 1 |
| E5 | #1 (control) | Same E1 with the box labelled "Trust score 78" of the person | Expect ≥2 of 3 misread it as a judgement — documents why D is rejected | 30 min | day 1 |

## Decision frame
- E1 and E2 pass → ship A+B+C as one card (`04-PRD` scope in 00-SYNTHESIS).
- E1 fails (readers hear "person") → drop the figure, ship B+C only (ledger without a number).
- E3 fails → identity strip prints the lineup state verbatim ("2 accounts unresolved") instead of a label.
- E4 fails → figure shown only for runs with a verify ledger; older runs print "verification record not kept".
