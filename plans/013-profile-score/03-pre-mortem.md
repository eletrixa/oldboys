# Pre-mortem: Profile score

Imagine it is the demo and the scorecard embarrassed us. What happened?

| # | Failure | Likelihood | Impact | Prevention (built in) |
|---|---|---|---|---|
| T1 | A judge reads "Score 43" as a judgement of the person; honesty points lost | Med | High | The figure is labelled "Role fit" with "share of must-haves with public evidence"; footer says what it is not; no colour scale; non-must-have lines print "no effect on fit" |
| T2 | Registry hit or CV difference listed under "Minuses" reads as an accusation | Med | High | Minus lines keep the source's own wording, carry an "Ask:" or "Check:" line, never a deduction; wording guard test (`JUDGEMENT`, `ACCUSATION`) |
| T3 | Card number disagrees with the Fit section | Med | Med | One formula (`fitPct`) exported from the composer and used by both |
| T4 | Profile missing (AI off, older run) → empty card or crash | Med | Med | Fallback to `per_question` coverage; card hidden only when there are no must-haves and no items |
| T5 | Namesake data (possibly-same-as) leaks into pluses | Low | High | Inputs are already identity-gated (profile evidence, registry hits attributed by city/employer, signals for merged accounts only); the composer adds nothing from `also_found` |
| T6 | Long lists push the brief down the page | Med | Low | Columns capped at 6 lines each, rest behind "Show all" |
| T7 | Partial must-have counted twice (plus and minus) confuses | Med | Med | Partial appears once, under pluses, with "+7 of 14, partly evidenced" |
| T8 | Points do not add up to the fit % due to rounding | High | Low | Points are the rounded share; the fit % is computed from the unrounded sum and the card says "rounded" when they differ |
| T9 | Czech brief shows an English card | High | Low | Same as the other cards: wrapped in `lang="en"`; translation deferred |
| T10 | Weight 0 must-haves divide by zero | Low | Med | Σ weight = 0 falls back to the stored `fit_pct` (same as today) |

Kill criteria: if T1 or T2 cannot be neutralised in copy, ship the ledger without the figure.
