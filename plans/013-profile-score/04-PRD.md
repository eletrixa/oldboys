# PRD: Profile score (role-fit scorecard)

## Problem
The report has the parts of a judgement but no single place that adds them up and shows why. Recruiters want "the score and the pluses and minuses"; the brief forbids scoring the person.

## Goal
One card, "Role fit scorecard", that prints the share of the hiring role's must-haves with public evidence (0..100) and lists every plus and minus the run found, each with evidence links and its effect on the number.

## Non-goals
Trust, personality, credit or culture scores; any number derived from risks, registries or account signals; storing the scorecard; Czech translation.

## Requirements
R1 `scorecard(state: RunState): Scorecard | null` in `src/app/runs/[id]/scorecard.ts`, pure, tested.
R2 Fit = Σ(weight × status) ÷ Σ(weight) × 100 over the hiring role's traits (status has 1, partial 0.5, none 0); Σ weight 0 → stored `fit_pct`. Without a profile: `per_question` `mh-*` coverage, weight 1. Null fit when there are no must-haves.
R3 Items (`ScoreItem`): `side` plus|minus, `area`, `text`, `kind` FACT|INFERENCE|CHECK, `points` (signed, whole, 0 outside must-haves), `source_ids` (profile evidence), `urls` (registry, signals), `ask`.
R4 Pluses: has (+points, FACT when any supporting FACT line), partial (+half with text "partly evidenced"), achievements with a strong supporting line (0 points), CV matches as one line (0).
R5 Minuses: none (−points, "no public evidence"), risks (0, ask = first question that closes it when present), CV differences (0, ask), challenged claims (0, ground as reason), registry hits attributed to the candidate (0, "Check:" with registry label), signals with an ask (0).
R6 Notes: counts of not searched and searched empty steps; "AI off" when degraded.
R7 `ScorecardCard` under the summary card: eyebrow, title, figure + bar + "n of m must-haves evidenced", two columns, each line with kind pill, points or "no effect on fit", source links `[n] host`, Ask/Check line; six per column then "Show all"; footer "what this is / isn't".
R8 Wording guard test: every `text` and `ask` passes `JUDGEMENT` and `ACCUSATION`.
R9 The Fit section and the card share `fitPct`.
R10 CHANGELOG line; JURY.md mention.

## Success
- `pnpm check` green; new tests for composer and card.
- On the local QA run the card appears, number equals section 5, each line links.
