# Brainstorm: Profile score (role-fit scorecard)

**Mode**: Ideas for an existing product (oldboys hiring report)
**Context**: Recruiters read a long brief (summary, profile, findings, CV check, challenges, registries, signals). Robert asked for one place that scores the profile and lists every plus and minus. The brief forbids trustworthiness and personality scores (brief hard rules, plans/012), so the only number allowed is the role-fit share that the report already prints (`position_fit.fit_pct`, weighted must-haves). Everything else can be a signed list, not a number.

## What already exists (inputs, zero new I/O)
| Signal | Where | Sign |
|---|---|---|
| Must-haves has / partial / none, weight 0..3, evidence lines | `brief.profile.position_fit[main role].traits` | + / ± / − |
| Must-have coverage without a profile (AI off or older runs) | `brief.per_question` `mh-*` coverage | + / ± / − |
| Achievements, Risks (each with FACT/INFERENCE evidence, strong/weak) | `brief.profile.achievements`, `.risks` | + / − |
| CV statements: matches, differs, not found | `cvCounts` (`cv-check.ts`) | + / − |
| Devil's advocate: claims that did not hold (ground) | `state.challenges` | − |
| Registry hits attributed to the candidate | `state.registry_checks` | − (check) |
| Profile signals with an ask | `state.profile_signals` | − (ask) |
| Not searched / searched empty | `brief.not_searched`, `searched_empty` | coverage, not a minus |

## PM perspective
1. **Scorecard card** — one card under the 30-second summary: fit % of the hiring role, bar, two columns "Pluses" and "Minuses", each line with evidence links and the points it adds or misses. | Impact H | Effort M
2. **Points, not vibes** — every must-have line prints its share of 100 so the recruiter can see what moves the number; non-must-have lines say "no effect on fit". | Impact H | Effort L
3. **Scorecard in the interview kit export** — the same lines in the kit so the interviewer walks in with the pluses and minuses. | Impact M | Effort L
4. **Position page column** — fit % per pooled candidate (plan 010 enrich) for side-by-side. | Impact M | Effort M
5. **Czech scorecard** — reuse the translate route for the item texts. | Impact L | Effort M

## Designer perspective
1. **Signed ledger, not a dashboard** — plus and minus as two quiet columns, serif figure, neutral bar (the report's Radar tokens); no red/green scale over the person. | Impact H | Effort L
2. **"What this is / isn't" footer** — one sentence: share of must-haves with public evidence, never a prediction or a judgement. | Impact H | Effort L
3. **Evidence on tap** — each line: FACT/INFERENCE/CHECK pill, `[n] host` link, "Ask:" when the line is an interview question. | Impact H | Effort M
4. **Empty states** — no must-haves known (AI off): the card shows coverage only; nothing at all: card absent. | Impact M | Effort L
5. **Print-friendly** — the card prints as the first page of the kit. | Impact L | Effort L

## Engineer perspective
1. **Pure composer** — `scorecard(state)` next to `summary30s`, no model, no I/O, tested with the same fixtures. | Impact H | Effort L
2. **One fit formula** — reuse the weighted formula from `profile-sections.tsx` (Σ weight × status ÷ Σ weight), moved to the composer so the card and the Fit section agree. | Impact H | Effort L
3. **Wording guard in tests** — every produced sentence passes `JUDGEMENT` and `ACCUSATION` (`challenge.ts`), like signals. | Impact M | Effort L
4. **Fallback to coverage** — when the profile is null, score from `per_question` coverage (evidenced 1, partial 0.5), so older runs and degraded briefs still get a scorecard. | Impact M | Effort L
5. **No new state field** — compute at render from `RunState`; nothing stored, nothing to migrate. | Impact M | Effort L

## Top 5
| Rank | Idea | Why | Quick win? |
|---|---|---|---|
| 1 | Scorecard card with signed ledger | The ask itself; all inputs exist | Yes |
| 2 | Points per must-have | Makes the number explainable, the honesty criterion (10%) | Yes |
| 3 | Pure composer + fallback | Zero cost, testable, covers old runs | Yes |
| 4 | Evidence on tap | Every claim links to a source (brief rule) | Yes |
| 5 | Kit export lines | Interviewer value | Later |

Position column and Czech scorecard are deferred.
