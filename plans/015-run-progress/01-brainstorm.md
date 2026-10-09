## Brainstorm: run progress communication (tray card + full-screen run page)

Mode: ideas for an existing product. Input: `evidence/context.md`, plus the code in `run-tray.tsx`, `run-tray-store.ts`, `run-view.tsx`, `parts.tsx` (ProgressSteps, Mark, percent, CostLine) and `state.ts` (RunState, stepRows, startedAgo, stalledNotice).

### Opportunity

A recruiter starts a brief and then waits 3 to 8 minutes, or starts up to 20 at once from a position. Today neither surface answers the three questions that matter: how long, what is happening, and what has it found. The page even gives a wrong number ("Usually 2 to 4 minutes"). The pause for the lineup question is the one moment where the run waits on a human, and the tray only shows a pill for it.

Objective: the recruiter always knows how long this will take, what it is doing, what it has found, and whether it needs them, without any invented precision.

Data we can use without a migration:

- `RunState`: `status`, `step` (last finished recipe step), `step_index` / `step_count`, `mentions`, `candidates` (platform, decision), `created_at`, `last_at`, `cost.duration_ms` (pauses excluded), `cost.source_calls`, `cost.llm_calls`, `headline`, `role`, `position`, `degraded`.
- Ledger rows: one per finished step with `step`, `ts`, `ms`, `kind`, `ref_json` (digests such as `code_profile`, `registry_checks`, `profile_signals`). There is no row when a step starts.
- Baseline timings per step id from `plans/013-run-latency/01-BASELINE.md`.

Glossary for the ideas below: "pool" means a recipe stage whose steps run up to 6 at a time (search pool, collect pool). "Typical range" means a low to high band taken from the baseline table, never a single number.

---

### Perspective 1: Product Manager

| # | Idea | Description | Impact | Effort |
|---|---|---|---|---|
| PM1 | Correct the promise | Replace "Usually 2 to 4 minutes" with "Usually 3 to 8 minutes" on the page, and show the same sentence once in the tray. Source: measured wall time 144 to 604 s. Fixes a false statement today. | H | L |
| PM2 | Elapsed plus typical range | One line on both surfaces: "2 min 10 s so far. Usually 3 to 8 min." Elapsed comes from `created_at` minus pause time (`cost.duration_ms` already excludes pauses). Honest because it states the range, not a countdown. | H | L |
| PM3 | Remaining-time band | Once the search pool has finished, show "About 1 to 3 min left" computed from which recipe steps still have no ledger row and their baseline durations. Hidden before the first step finishes. | H | M |
| PM4 | "Longer than usual" state | When elapsed passes the high end of the band, the line changes to "Taking longer than usual. Slow sources are still being read" and never counts into negative time. The existing 30 minute stalled notice stays as the second tier. | H | L |
| PM5 | "Needs you" as the loudest state | When `status = paused`, the tray row turns to an action card: "Is this the right person? 1 question. The run waits for you." with a direct link to the question. The page already focuses the card; the tray should make it unmissable across pages. | H | M |
| PM6 | Found-so-far counters | Tray and page show plain counts the run already has: public mentions (`mentions`), profiles to confirm (`candidates.length`), later claims found. Counts only, no ranking, no verdict. | M | L |
| PM7 | Batch summary for a position | When the tray holds several runs, the header reads "6 of 12 briefs ready, 2 need your answer, ~4 min left for the rest". A single summary beats scanning 12 rows. | H | M |
| PM8 | Needs-answer first sorting | In the tray, runs with `paused` sort to the top, finished ones sink, then running by progress. Recruiters should handle blockers first when 20 runs go at once. | M | L |
| PM9 | "Leave and come back" promise | Say once, plainly, where the brief ends up: "You can leave. It stays in My briefs." Already partly present; make it a single stable sentence and remove the duplicate on the tray. | L | L |
| PM10 | Per-candidate ETA scored by role history | Predict duration from past runs of the same role family stored in D1. Rejected for round 1: needs a query per poll and new data modelling; revisit only if the shared typical table proves too coarse. | M | H |
| PM11 | "Findings so far" preview of the brief | Stream finished claims into the page as they appear. Rejected: claims only exist after extract and verify, and showing unverified claims breaks FACT versus INFERENCE (FACT needs passed verify). | M | H |

Rejected in this table: PM10 (deferred, not conflicting), PM11 (conflicts with the verify rule).

---

### Perspective 2: Product Designer

| # | Idea | Description | Impact | Effort |
|---|---|---|---|---|
| D1 | Phase line instead of five dots | Tray row shows "Step 2 of 5: Making sure it is the right person" in text next to a thin bar. Five unlabeled dots tell the recruiter nothing at 22rem width. | H | L |
| D2 | Two-layer progress bar | Solid fill for finished work, a lighter "likely range" band ahead of it. The band widens when the estimate is uncertain and collapses toward done. The bar itself shows the honesty. | M | M |
| D3 | Reading list ("sources being read") | Page shows rows such as "Google results, GitHub, X, company site" with ticks for sources that have a ledger row and a quiet circle for the rest. Uses the recipe step ids mapped to human labels in `source-labels.ts`. Does not claim which one is running right now, only which are done and which remain. | H | M |
| D4 | Mention counter that ticks | The existing "Found N public mentions" line becomes a live count with a polite live region, and the tray repeats it as "12 mentions". | M | L |
| D5 | Lineup card in the tray | When paused, the tray row shows the first question in short form with the two main answers ("This is them", "Someone else") so the recruiter can answer without leaving the page they are on. The answer POST already exists. | H | H |
| D6 | Confirmed profile chips | As lineup decisions arrive, show small platform chips (LinkedIn, GitHub, X) for confirmed accounts on the page header and a count in the tray. Shows progress and gives a feeling of substance; only platform names, no scores. | M | M |
| D7 | Calm motion, honest stillness | The pulse on the active step uses `motion-safe`; with reduced motion the active step gets a text label "In progress" and a static ring. No spinner implies time passing when nothing changes. | M | L |
| D8 | Phone layout | At phone width the page puts elapsed and phase in a sticky strip under the header; the tray collapses to a single line "3 briefs: 1 needs you" that expands on tap. Tray width stays 22rem, hit targets 44 px. | H | M |
| D9 | Row density for 20 runs | Tray row for a running brief is two lines (name, one status line with elapsed and phase). Details open on demand. Keeps 20 rows scannable in a 50vh scroll area. | H | M |
| D10 | Fake smooth progress bar | A bar that creeps forward on a timer between polls. Rejected: invents progress that has no data behind it, and the bar would stall or jump anyway when a slow search pool step returns. | L | L |
| D11 | Playful messages ("Brewing coffee...") | Rotating filler text while waiting. Rejected: noise on a trust-sensitive product, and it hides the real status. | L | L |

Rejected in this table: D10 (fake progress), D11 (filler).

---

### Perspective 3: Software Engineer

| # | Idea | Description | Impact | Effort |
|---|---|---|---|---|
| E1 | `steps_done` in the state route | Add `steps_done: string[]` (recipe step ids with a ledger row) to `RunState`. Payload grows by a few dozen short strings, no new query because the route already reads the ledger. Base for every other estimate. | H | L |
| E2 | Pure `run-eta.ts` in `src/domain` | Typical-duration table per step id (low, high seconds, from the baseline) plus a function `projectRun(stepsDone, recipeSteps, elapsedMs)` giving share done, remaining band, current phase and remaining source labels. Unit-tested with Vitest next to it; no I/O, no model. | H | M |
| E3 | Pool-aware remaining time | Model parallel pools as `max(longest remaining, sum of remaining / 6)` and the serial tail (resolve, extract, verify, synthesize) as a sum. Keeps the estimate correct when the recipe gets faster, because the table is per step and the shape comes from the recipe. | H | M |
| E4 | Local 1 s clock | A `useNow(1000)` hook in the page and tray ticks elapsed and remaining between 2 s and 4 s polls so numbers move smoothly. Pauses polling work when the tab is hidden (`visibilitychange`) to save battery. | M | L |
| E5 | One poller per run, shared by tray and page | The tray and the page poll the same URL. A small shared store keyed by run id would make the page reuse the tray fetch and vice versa. Fewer requests with 20 runs. | M | M |
| E6 | Batched tray poll | Instead of 20 fetches every 4 s, one `GET /api/runs/states?ids=a,b,c` returning only the tray fields. Cuts requests from 20 per 4 s to 1. Needs a new route and a size check; justify only if 20-run use is real. | M | M |
| E7 | Adaptive poll interval | Tray polls every 4 s when paused or in the last pool, every 8 to 10 s while a long search is running, and stops for runs in a hidden tab. Reduces D1 load without losing responsiveness for the lineup pause. | M | L |
| E8 | Calibrate the table from live ledgers | A script (not a runtime path) reads `ledger_entries.ms` for finished runs and prints new low and high values per step for `run-eta.ts`. Run after plan 013 phases 2 and 3 land. Keeps the table honest after speedups. | M | M |
| E9 | Server-recorded step starts (new ledger kind) | Write a `start` row when a step begins so the UI can name the step running now. Rejected: changing the ledger kind CHECK needs a migration, which the context says to avoid; the finished-steps view plus remaining sources gives most of the value. | M | H |
| E10 | SSE push for the tray | Replace polling with an event stream. Rejected: context says polling stays; and a stream per run times 20 runs on Workers is costly. | L | H |
| E11 | Percentile calibration per role family from D1 | Same as PM10 on the data side. Deferred with PM10. | M | H |

Rejected in this table: E9 (needs a migration, conflicts with the avoid-a-migration constraint), E10 (conflicts with polling decision). Deferred: E11.

---

### Coverage of the required topics

| Topic | Ideas |
|---|---|
| Time: elapsed, typical range, remaining, "longer than usual" | PM1, PM2, PM3, PM4, D2, E2, E3, E4, E8 |
| What is happening now (sources) | D1, D3, E1, E2 (remaining source labels) |
| What was found so far | PM6, D4, D6 |
| Paused / lineup state | PM5, PM8, D5 |
| Many runs at once | PM7, PM8, D9, E5, E6, E7 |
| Phone width | D8, D9 |
| Accessibility | D4 (live region), D7 (reduced motion), D8 (44 px targets); see below |
| Honesty | PM1, PM4, D2, D3, D10 rejected, D11 rejected, E9 and E10 rejected for cost |

Accessibility notes that apply to whatever is chosen:

- One polite live region per surface announcing phase changes and "needs your answer", not every second tick. Elapsed time must not be in a live region, or screen readers read it every second.
- The progressbar keeps `aria-valuetext` with the phase and the range in words, not a fake percent.
- Under `prefers-reduced-motion`, no pulse or width transition; the active state is a text label.
- Status never relies on colour alone (pill text plus the phase line).

Honesty rules that apply to whatever is chosen:

- Every time statement is labelled "usually" or "about", and given as a range.
- No remaining time before the first search finishes; before that only elapsed and the typical range.
- Pause time is excluded from elapsed research time and the paused state shows no clock running against the recruiter.
- If the table is out of date the estimate widens; it never claims precision it does not have.
- CACHED and MOCK labels stay where they are today.
- Counts only for findings; no score, no verdict word.

---

### Top 5 Recommendations

| Rank | Idea | Why | Quick win? |
|---|---|---|---|
| 1 | PM2 + PM1 + PM4 (elapsed, correct typical range, "longer than usual") | Fixes the wrong promise and answers "how long" on both surfaces with one honest sentence. No backend. | Yes |
| 2 | E1 + E2 + E3 (steps_done and pure `run-eta.ts` with pool-aware remaining band) | The single data foundation for remaining time, phase, and remaining sources; stays correct when plan 013 makes runs faster. | No, but small and testable |
| 3 | D1 + D3 (phase text and reading list of sources) | Tells the recruiter what is happening in words instead of five dots, using only finished steps. | Partly |
| 4 | PM5 + PM8 (paused as an action state, first in the tray) | The only moment the run waits on the recruiter; today it is a small pill. D5 (answer inside the tray) is a later step. | Partly |
| 5 | PM7 + D9 + D8 (batch summary, compact rows, phone strip) | Makes 20 runs and phone width usable; without it the extra per-row detail turns the tray into a wall of text. | No |

Also cheap and worth bundling with rank 1: PM6 / D4 (live mention count), D7 (reduced motion), E4 (local 1 s clock), E7 (adaptive polling).

Key assumptions to validate:

1. The baseline table (10 prod runs) is representative enough for a low to high band; check against 20 or more runs after plan 013 phase 1 is measured live.
2. Recruiters read a range ("usually 3 to 8 min") as honest and useful rather than vague; check in a short test with two recruiters.
3. Finished steps alone (no start rows) are enough to name the current phase; check that the phase line never lags a slow search by more than one poll.
4. Recruiters with 5 or more briefs want the summary header; check against how positions are really used (plan 010 pool size).
5. The tray can show a lineup answer without hiding context; the lineup card currently needs the platform list and identity map beside it.

### Next steps

1. Decide direction among A to D in the context (this brainstorm leans to C: ledger-projected progress, no migration).
2. Write the round 2 dossier: architecture options steelmanned, with the decision matrix, and the table of step durations used by `run-eta.ts`.
3. Spike E1 and E2 with Vitest first (pure functions against the recorded baseline runs), then wire the page, then the tray.
4. Ship rank 1 as its own small change with a CHANGELOG line, since it is user-visible and independent.
5. Measure plan 013 phase 1 live and recalibrate the table before claiming any remaining-time band in production.
