# Profile score — Synthesis & Decision

> **Decision: ship a deterministic "Role fit scorecard" card.** The only number is the weighted share of the hiring role's must-haves with public evidence, the same formula the Fit section already prints. Every plus and minus the run found is listed under it with evidence links; lines outside the must-haves are marked "no effect on fit". No model, no I/O, no stored field. Dossier: 01 brainstorm, 02 discovery, 03 pre-mortem, 04 PRD.

## Why this shape
- Brief bans personality, credit and trustworthiness scores. Evidence coverage of a role profile is not one of those, and the report already prints it; the card makes it explainable.
- Risks, registry hits, CV differences and account signals are open points for the interview. Turning them into deductions would make a trust score; they stay at 0 points with an Ask or Check line.
- All inputs exist in `RunState`; the composer is the summary card's sibling (`summary.ts`).

## Code
- `src/app/runs/[id]/scorecard.ts` (+ `__tests__/scorecard.test.ts`): `scorecard`, `fitPct`, `ScoreItem`.
- `src/app/runs/[id]/scorecard-card.tsx` (+ test): the card.
- `profile-sections.tsx` imports `fitPct` from the composer.
- `parts.tsx` renders the card after the summary card.
