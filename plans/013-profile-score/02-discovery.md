# Discovery: Profile score

## Opportunity
A hiring manager opens the report and asks "so, is this person a fit?". Today the answer is spread across six cards. The fit % exists but is buried in section 5 of the profile. Risks, CV differences, failed challenges and registry hits each sit in their own card. The recruiter does the summing in their head.

## Desired outcomes
- Time to first judgement under 30 seconds (same bar as the summary card).
- The recruiter can say *why* the number is what it is, pointing at a line with a source.
- Nothing in the card can be read as a score of the person: a judge checking the honesty criterion finds the number explained as "share of must-haves with public evidence".

## Users and jobs
- **Hiring manager** (reads one report): wants the number plus the three things to ask.
- **Recruiter** (reads many): wants pluses and minuses they can paste into an ATS note or the kit.
- **Jury** (judges honesty and value): wants to see FACT split from INFERENCE and the formula in the open.

## Assumptions (mapped)
| Assumption | Risk | Evidence / test |
|---|---|---|
| A1 The weighted must-have share is an acceptable "score" under the brief | High (honesty) | Already printed as fit %; the brief bans personality / trust / credit scores, not evidence coverage. Footer states it. |
| A2 Recruiters understand signed points ("+14 of 100") | Medium | Same convention as the Fit section weights; copy test with Robert. |
| A3 Listing registry hits and CV differences as "minuses" does not read as an accusation | High | Minus = "open point", printed with "no effect on fit" and an "Ask:" line, never a deduction. |
| A4 Older runs without a profile still get a useful card | Low | Fallback from `per_question` coverage. |
| A5 No new LLM call is needed | Low | All inputs deterministic. |

## Solution shape
`scorecard(state)` returns `{ fit, role, checked, pluses, minuses, notes }`. Pluses: must-haves with evidence (+points), partially evidenced must-haves (+half, and the missing half listed as a minus), achievements with independent evidence (no points), CV statements that match (no points). Minuses: must-haves without evidence (−points), risks, CV differences, challenged claims, registry hits, profile signals with an ask (all "no effect on fit", each with an ask or a check). Notes: sources not searched or empty.

## Experiments (cheap)
1. **Copy test**: show the card to Robert with a real run; can he explain the number in one sentence? Success: yes without reading the footer.
2. **Wording guard**: unit test runs every sentence through `JUDGEMENT` / `ACCUSATION`.
3. **Delta check**: for the eval set, hiring vs due-diligence goals must produce different scorecards (goal-delta rule).

## Out of scope
Position-page column, Czech translation of the card, storing the scorecard in D1.
