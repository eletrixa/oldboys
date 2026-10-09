## Pre-Mortem: run progress communication

Plan under test: option C from `evidence/context.md`. The state route adds `steps_done`. A pure `src/domain/run-eta.ts` holds a typical-duration table per step id and derives a time-weighted share, a remaining-time range, the current phase and the sources still to read. The page ticks a 1 s local clock between polls. Tray and page share the projection. UI: ETA range line, "reading now" line, "found so far" strip, a prominent "Needs your answer" in the tray, and "taking longer than usual" after p90.

Failure story (14 days out): the jury watches a live demo run. The page says "about 3 to 5 minutes left" and "Reading LinkedIn posts now". The recipe is by then two to three times faster, so the run finishes at 1:40 while the page still promised minutes. Or a slow SERP step pushes the run past the promised range and the page counts down to zero and sits there. Elsewhere a recruiter starts 20 candidates from a pool. The tray shows twenty ETAs that disagree with each other, three runs are waiting on a lineup question that nobody sees, and the state route is hammered by 40 polling tabs. Honesty is 10 % of the score and "no fake progress" is a stated constraint, so a wrong number on screen is the most expensive kind of bug here.

Facts checked in code while writing this:
- The run page polls every 2 s (`run-view.tsx`, `POLL_MS`), the tray every 4 s per run (`run-tray.tsx`). Each poll is `loadRunState`, which runs one head query plus five more (candidates, claims, sources, brief, the whole ledger). Nothing is cached.
- `RunState` is built as one object literal in `load.ts` and is constructed by hand in many test fixtures (about 15 files under `src/app/runs/[id]/__tests__`, `src/app/_components/__tests__`, the translate and state route tests). A new required field breaks typecheck in all of them.
- `step` is the last step that wrote a row. Pool steps finish out of order, so it is not a position.
- `src/domain/run-status.ts` is also compiled in `extension/` with relative imports only. `run-cost.ts` already excludes pauses; `isStalled` uses 30 minutes.
- The progress component has a `role="status"` sr-only paragraph that announces the active label. Any ticking text placed inside a live region would be read every second.

### Tigers (Real Risks)

**T1. The duration table is calibrated on the old serial recipe and rots as plans/013 lands. Launch-blocking.**
The 10 baseline runs were serial. Phase 1 (parallel pools) is shipped but not measured live. Phases 2 and 3 cut 2 to 5 times. A table of per-step typical seconds then overstates every step that moved from Apify to REST, and the "taking longer than usual" threshold never fires because it is set far too high.
Mitigation:
- Store the table as data in `src/domain/run-eta.ts` next to a `CALIBRATED_ON` date and a `RECIPE_REV` constant, and add a test in `src/domain/__tests__/run-eta.test.ts` that fails when the set of step ids in `hiring.ts` differs from the table keys (a new or renamed step cannot ship without a number).
- Before the jury demo, refit the table from post-phase-1 production runs using the same ledger query as `pnpm bench:latency` (plans/013). Record the refit in `docs/ops/llm-manual-runs.md` style evidence if any run is made for it.
- Every phase of plans/013 gets a checklist line "refit run-eta table" in its PR description.
- Show the range, not a point, and widen it by the observed spread. Never show seconds in the range.

**T2. Parallel pools make "remaining time" wrong in both directions. Launch-blocking.**
The plan counts a pool as max over window and the tail as serial. A pool with 21 collectors and a window of 6 finishes in a lumpy way: eight quick REST steps finish in the first seconds, then YouTube or the crawler hold the pool for 30 s. A share computed from finished count jumps; a share computed from time weights stalls. The paid budget (18 calls, $0.50) also makes some steps skip instantly with "run budget reached", so a step that was in the table for 25 s completes in 0 s.
Mitigation:
- In `run-eta.ts`, model each pool as `max(sum(remaining) / PARALLEL, max(remaining))` and test it with a table-driven test: empty pool, one slow straggler, all fast, budget-skipped steps.
- A step whose ledger row says `skipped` or `kind: decision` counts as done at zero cost, and the share only ever moves forward (monotonic clamp in the function, tested).
- Remaining-time range lower bound is never below the serial tail (extract + verify + synthesize), tested.

**T3. The paused state leaks human time into the ETA. Launch-blocking.**
When the lineup question is open the ETA must not tick, and after the recruiter answers the clock must resume from the projection, not from `created_at`. `created_at` to now includes the pause. If elapsed is computed that way the page says "taking longer than usual" for every run that paused, which is exactly the demo path with a namesake.
Mitigation:
- The projection takes `duration_ms` from `runCost` (already pause-excluded) as the elapsed research time at the last poll, and the local ticker adds only `Date.now() - polledAt` while `status === "running"`. While `paused` the ticker is off and the line reads "Waiting for your answer. Time stops while we wait."
- Tests in `run-eta.test.ts`: paused run returns no ETA and no overdue flag; a run that resumed after a 20 minute pause shows the same remaining range as one that did not pause.
- Browser check in the QA loop (`oldboys-local-qa-loop`): pause, wait 90 s, answer, confirm the range did not shrink or turn overdue.

**T4. Adding a required `steps_done` breaks the typecheck of about 15 test fixtures, and so the Stop hook. Launch-blocking.**
`RunState` fixtures are hand-built. The Stop hook runs `pnpm check`, which blocks every shared-checkout session on this one field, and peers editing other files get blocked too (see the shared-checkout memory).
Mitigation:
- Make the type `steps_done?: string[]` only if every reader handles undefined (it must anyway, see T5), and compute a default in one helper. Alternatively add the field to the shared fixture factory first. Pick one in the plan; do not mix.
- Land the type, the helper and the fixture fix as one commit before the UI, run `pnpm check` in an isolated worktree first, and name the files touched in the PR.
- Owner: whoever implements `state.ts`; due before any UI work starts.

**T5. Old payloads, old runs and cached or replayed runs have no `steps_done`. Launch-blocking.**
A tab that was open during the deploy, a service-worker or CDN-cached response, a CACHED replay, and the extension all can hand the new UI a state without the field. `undefined.length` throws in render and the run page goes blank mid-demo.
Mitigation:
- The projection function accepts `steps_done | undefined` and falls back to the existing `step_index / step_count` bar with no ETA line ("Time left: not estimated for this run"), tested with a state that lacks the field and with a state of `status: "done"` that never ran the recipe.
- A run that is `done` or `failed` never shows an ETA, only the final duration from `cost.duration_ms`.
- Error boundary is not needed; the pure function returns `null` for anything it cannot read, and the UI renders nothing for `null`.

**T6. "Reading now" is really "not finished yet", so it will name the wrong source. Launch-blocking.**
The ledger has no start rows. In a pool of six, the plan can only say which steps have no row yet. Picking the first one by table order shows "Reading YouTube" while the run is really waiting on the SERP, and when it finishes the label flips to a different not-started step. This is a fake claim in front of a judge who is scoring honesty.
Mitigation (cheapest honest option, no migration):
- Replace "Reading X now" with "Still waiting for: X, Y and 3 more" built from the unfinished steps that the scheduler could have started (all pool members minus done ones). Copy lives in `run-eta.ts` as pure functions and is tested to never contain "now" or a single-source claim when more than one step is open.
- Use the wording "Reading" only for the serial tail (extract, verify, synthesize), where exactly one step can be running. Test that mapping.
- Option D (recording starts) stays a recorded follow-up, not a launch dependency.

**T7. The 1 s local ticker spams screen readers and burns phones. Launch-blocking.**
The progress block already has a `role="status"` paragraph. If the ETA text sits in or near a live region, a screen reader announces every second. A 1 s `setInterval` per tray row (20 rows) also re-renders the whole tray every second, on a phone.
Mitigation:
- The ticking text is outside any live region and has `aria-hidden="true"` for the seconds part. The live region only announces phase changes and "taking longer than usual", at most once per change, and the ETA range is coarse (whole minutes) so it changes rarely.
- One shared clock for the tray (a single `useNow` hook with one interval), not one interval per row; the clock updates every 1 s only on the run page and every 5 s in the tray, and stops when `document.hidden` (visibilitychange) or when no run is live.
- `prefers-reduced-motion`: the bar width transition and the pulsing dot already use `motion-safe`; the new strip must not animate counters. Test: a component test that renders the progress block and asserts that the live region text does not change between two ticks of the fake clock.

**T8. Clock skew and timezones between server timestamps and `Date.now()`. Launch-blocking.**
`created_at`, `last_at` and ledger `ts` are written by the Worker clock. `Date.now()` is the laptop clock. A laptop that is 90 s fast shows "Started 1 min ago" at start and an immediate overdue flag; a slow one shows negative elapsed. A timestamp string without `Z` is parsed as local time by `Date.parse`, which shifts everything by the UTC offset (Prague is +1/+2 h) and would show runs as hours old.
Mitigation:
- Never compute elapsed from `Date.now() - Date.parse(created_at)`. Use the server's `cost.duration_ms` (or a new `elapsed_ms` computed at read time in `load.ts`) as the base at the moment of the poll, and add only the local delta since that poll arrived (monotonic `performance.now()`, not wall time).
- Tests: `run-eta.test.ts` with ts strings with and without `Z`, with a client clock shifted by plus and minus 5 minutes, expecting the same output; clamp negatives to 0.
- Check the stored `created_at` format in D1 once and write it into the test.

**T9. Twenty runs at once: polling load on D1 and a tray that is unreadable. Fast-follow (launch-blocking only for the demo of the pool).**
20 runs times 2 tabs times the 4 s tray poll is 10 state loads per second, each with six queries including a full ledger read and the claims table. Finished runs stop polling, but runs near the end load a large payload (claims, sources, brief). Adding `steps_done` and a projection is cheap, but the stack of 20 rows with an ETA each pushes the tray past its `50vh` scroll area and hides "Needs your answer" rows below the fold.
Mitigation:
- Implement lever L16 from plans/013 (short-circuit on unchanged `max(seq)` with a 304, no excerpts in the poll) or at minimum a light `?view=progress` response that returns only the fields the tray needs; owner: whoever owns `route.ts`; test in `route.test.ts`.
- Tray sorts "Needs your answer" first, then running, then done; with more than 5 runs it collapses to one aggregate line ("14 running, 2 need you, 4 ready") above the list. Test the sort and the aggregate in `run-tray-store.test.ts`.
- Back off polling to 8 s when `document.hidden` and when more than 10 runs are live.

**T10. A paused run in the tray is invisible among many. Launch-blocking for pool use.**
A paused run waits forever. Today it shows an amber pill like any other state, with a status dot that stops pulsing, and it sits wherever its insertion order puts it. At 20 runs the recruiter never sees it, and the "wait" that the ETA promises never ends.
Mitigation:
- "Needs your answer" gets the action colour, a count in the collapsed pill ("Briefs in progress (20), 2 need you"), a link straight to the lineup question, and sorting to the top (`run-tray-store.ts`, tested).
- The collapsed state must show the count of runs that need an answer; add a `document.title` prefix "(2) " while any run is paused (one line in the tray, tested through a pure helper).

**T11. Stalled, failed and degraded runs get a countdown that lies. Fast-follow, with the stalled case in T12.**
- Failed: the ETA line must vanish and the row must say "Stopped at <label>" with the reason, not "3 min left".
- Degraded ("AI unavailable", extract skipped or empty): the run still finishes but quickly and without a profile. The projection would promise 90 s for synthesize that will never take that long, then jump to done. Fine for the user, but the copy must not claim steps happen that do not.
- Interrupted runs: a Workflow that died stays `running` for up to 30 minutes before the stalled notice.
Mitigation:
- `run-eta.ts` returns `kind: "none" | "estimate" | "overdue" | "paused" | "stalled"`; only "estimate" renders a range. Tests per kind, including `failed` and a run with a `gap` row for the AI step.
- Lower the "no recent activity" notice for the ETA line: when the last ledger activity is older than the longest single step in the table times 2 (about 3 min), replace the range with "No news for N min. Still waiting for X" without waiting 30 minutes. The existing 30-minute notice and retry link stay.

**T12. "Taking longer than usual" fires on normal runs or never. Fast-follow.**
p90 comes from 10 runs, one with a 604 s outlier, and covers a different recipe. With 10 samples p90 is basically the maximum.
Mitigation:
- Define "longer than usual" as elapsed research time greater than the upper bound of the displayed range plus 25 %, not a separate p90 constant, so the two numbers can never disagree. Test the boundary.
- When overdue, drop the countdown and show "Taking longer than usual. We are still working; the brief will appear in My briefs." Never show 0 or negative time.
- Track, via the existing duration in the ledger, how often runs end overdue; if more than 15 % do after launch, refit (see T1).

**T13. The extension compiles `run-status.ts` and polls `/api/runs/:id`. Launch-blocking only if `run-status.ts` is touched.**
Putting estimator code into `run-status.ts` or importing `@/` paths into it breaks `extension/` (`wxt: command not found` style failures or a failed `pnpm --filter oldboys-extension check`). The extension has its own wire schema and its poll test.
Mitigation:
- Do not edit `src/domain/run-status.ts` for this plan. `run-eta.ts` is a separate file, and the `/api/runs/:id` wire shape stays unchanged. The extension is never given the ETA.
- Add one test that imports `run-status.ts` only (existing `run-status.test.ts`) and run `pnpm check` (it includes the extension) in an isolated worktree before committing.

**T14. Phone width and long Czech labels. Fast-follow.**
The tray is `22rem` and `max-w-[calc(100vw-2rem)]`. Adding an ETA line, a phase line and a found-so-far strip to each row makes a row three to four lines tall, so one run fills the tray on a phone, and the tray spacer (`TraySpacer`) pushes the page content. Czech labels and "Needs your answer" translations are longer.
Mitigation:
- Tray row shows at most two lines plus the pill: title and one status line ("About 2 to 3 min left" or the phase). The found-so-far strip is page-only, with counts only ("14 sources, 6 profiles"), wrapping with `flex-wrap` and non-breaking spaces as `CostLine` does.
- Check at 360 px and 320 px with the chrome-devtools resize tool; add the screenshots to the PR. Tray height formula in `TraySpacer` is updated in the same change.

**T15. "Found so far" invites a verdict. Launch-blocking if the strip shows claims or flags.**
Brief rules forbid scores and trust words, and mid-run claims are unverified. A strip that says "12 facts found" before verify runs shows numbers that later drop when the devil's advocate downgrades claims, which looks like backtracking and counts as a fake FACT label.
Mitigation:
- The strip may show only sources read and platforms reached ("9 sources from 5 places"), never claims, FACTs, matches or flags before the verify step has a row. Pure function with a test that feeds claims into the state and asserts the strip output does not change.
- No "found" words next to named platforms for unconfirmed candidates; for a pre-lineup run say "possible profiles", matching how identity is handled.

### Paper Tigers (Overblown Concerns)

**P1. "The ETA will be wrong, so do not show one."** A wrong point estimate is a problem; a range labelled "usually" with an honest overdue state is not. The brief requires communicating how long it takes, and it is the user's explicit request. The honest failure mode is already designed in (range, "usually", overdue copy, no negative time).

**P2. "We need per-role or per-subject calibration (option D)."** The variance between roles is smaller than the variance caused by one SERP timeout, and the table is refit by hand when the recipe changes. A D1 history query on every poll is a larger risk than a slightly wide range. Revisit after 50 production runs.

**P3. "Client-side ticking will drift or desync from the server."** The ticker only adds a local delta to a server-given base, and every poll resets the base. Drift over a 2 or 4 s window is below the rounding of a minute-level range. T8 covers the real problem, which is wall-clock subtraction.

**P4. "SSE or WebSocket is needed for smooth progress."** Polling at 2 s is more than the grain of the data, since a ledger row appears only when a step ends, every few seconds at best. Smoothness comes from the local clock, not from push. The plan already excludes SSE for the page.

**P5. "The tray will hurt page performance."** One state fetch per live run per 4 s with a few small components is negligible next to the Next.js page itself. The real cost is server-side (T9), not client rendering, provided there is one shared interval (T7).

**P6. "The duration table is a secret model of the AI."** It is a lookup of seconds per step id, with no model and no score of a person. It does not touch the Art. 9 or "no scoring" rules.

### Elephants (Unspoken Worries)

**E1. The estimate is calibrated on 10 production runs from before the parallel pools shipped, and nobody has measured after.**
Phase 1 is in main but `oldboys-run-latency` says live timing is not yet measured. We would ship numbers for a system we have not timed. Investigation: run `pnpm bench:latency` (or the manual ledger query) on 5 to 10 fresh runs of the three reference subjects, post phase 1, and fit the table from those; decide a freeze date for plans/013 phase 2 so the demo recipe and the table match. If phase 2 lands in the same week, calibrate after it, not before.

**E2. The ledger has no step-start rows, so everything labelled "now" is a guess.**
We know this (T6) but the plan text still talks about "reading now". The unspoken question is whether we accept the honest weaker wording, or pay for a migration (a `start` kind needs a CHECK change, a rule that says avoid). Investigation: measure how often "still waiting for X, Y" would be wrong versus right on 5 runs by comparing with Apify run start times; if the pool is mostly short steps, the weaker wording is enough.

**E3. An ETA that is wrong in the demo costs honesty points, and nobody owns the demo run.**
The jury sees one run. A cold SERP actor that times out (45 to 90 s) in that run breaks any table. Investigation: pick the demo subjects, pre-run each 3 times in the same week, record the spread, and decide whether the demo uses a CACHED replay (labeled) for the timing story. Also decide on stage whether to say the range out loud.

**E4. The "Usually 2 to 4 minutes" copy has been wrong for a day and is live.**
Measured runs take 3 to 8 minutes, and the line is in `run-view.tsx` at line 272 on prod. This is already a honesty defect independent of option C. Investigation: ship the one-line copy fix ("Usually 3 to 8 minutes, sometimes longer") immediately as its own commit with a CHANGELOG line, so the failure does not depend on the whole plan landing. Then delete the line when the computed range replaces it.

**E5. D1 polling load with 20 runs by 2 tabs has never been tested.**
Plans/010 allows 20 enrich runs and the tray polls each. Nobody has measured read units or latency of `loadRunState` under that. Investigation: a local script that opens 40 pollers against `wrangler dev` with real ledger sizes, reports p95 latency and D1 rows read per second, and compares with the free-tier read budget. Decide on T9 mitigations from that number, not from a guess.

**E6. Who maintains the table when a collector is added or an actor is swapped?**
The recipe changes weekly and several agents edit the shared checkout. If nobody owns the table, the test from T1 will be "fixed" by adding a placeholder 10 s. Investigation: put the table next to the step definitions or derive its default from a field on `Step` (typicalSeconds) so the number moves with the step, and decide this before writing `run-eta.ts`.

### Action Plans for Launch-Blocking Tigers

| Tiger | Risk | Mitigation | Owner | Due |
|---|---|---|---|---|
| T1 | Table rots as the recipe gets faster | `CALIBRATED_ON`, step-id parity test, refit from post-phase-1 runs, refit line in each plans/013 PR | implementer of `src/domain/run-eta.ts` | before UI merge, and again after each plans/013 phase |
| T2 | Pool math gives jumps or false remaining time | max/window formula, monotonic share, serial-tail lower bound, table-driven tests | same | with run-eta |
| T3 | Pause time counts as research time | elapsed from `runCost.duration_ms`, ticker off while paused, resume test | same, plus QA loop check | with run-eta; browser check before merge |
| T4 | New field breaks about 15 fixtures and the Stop hook | one commit for type, helper and fixtures, `pnpm check` in an isolated worktree | implementer of `load.ts` / `state.ts` | first commit of the plan |
| T5 | Missing `steps_done` crashes the page | optional input, `null` projection, fallback to the old bar, tests for old payload and done runs | implementer of `run-eta.ts` and `run-view.tsx` | with run-eta |
| T6 | "Reading now" is a guess | "Still waiting for" wording; "Reading" only for the serial tail; wording test | implementer of copy in `run-eta.ts` | before UI merge |
| T7 | Live-region spam, interval per row, battery | ticker outside live region, one shared clock, hidden-tab stop, reduced motion, component test | implementer of `run-view.tsx` and `run-tray.tsx` | before UI merge |
| T8 | Skew and timezone errors | server `duration_ms` as base plus local monotonic delta, skew tests, check `created_at` format | implementer of `run-eta.ts` | with run-eta |
| T10 | Paused run lost among many | action colour, top sort, count in collapsed pill, title prefix | implementer of `run-tray.tsx` and `run-tray-store.ts` | before UI merge |
| T13 | Extension build breaks | do not touch `run-status.ts`, wire shape unchanged, `pnpm check` incl. extension | whoever edits shared domain files | every commit |
| T15 | "Found so far" shows unverified claims | sources and places only, pure function test | implementer of the strip | before UI merge |

Also before launch regardless of the plan: ship the E4 copy fix now, and run the E1 measurement before the table is frozen.

### Go / No-Go Checklist

- [ ] `pnpm check` passes in an isolated worktree, including the extension and all fixtures (T4, T13).
- [ ] `src/domain/__tests__/run-eta.test.ts` covers: pool math, budget-skipped steps, monotonic share, paused, resumed after pause, failed, degraded, overdue, missing `steps_done`, skewed client clock, timestamps with and without `Z` (T2, T3, T5, T8, T11).
- [ ] Step-id parity test between `hiring.ts` and the table passes (T1, E6).
- [ ] Table refit on at least 5 post-phase-1 production runs, date recorded in `CALIBRATED_ON` (T1, E1).
- [ ] Three reference subjects run end to end in the preview; actual wall time falls inside the displayed range for at least 2 of 3, and the third shows the overdue copy correctly (E3).
- [ ] Pause test in the browser: ticker stops, range does not shrink during or after the pause (T3).
- [ ] No ETA text inside a live region; screen reader pass (VoiceOver or NVDA) announces phase changes only; reduced-motion check (T7).
- [ ] 20-run local load test: p95 state latency and D1 rows read per second recorded, polling back-off in place (T9, E5).
- [ ] Tray at 360 and 320 px: two lines per row, paused rows on top, count of runs needing an answer visible when collapsed (T10, T14).
- [ ] "Found so far" shows sources and places only and does not change when claims change (T15).
- [ ] No "Reading X now" copy outside the serial tail (T6).
- [ ] The old "Usually 2 to 4 minutes" line is gone or corrected (E4).
- [ ] CHANGELOG.md line under Unreleased; file headers on every new file; `src/domain/run-status.ts` untouched (T13).
- [ ] Decision logged: demo uses a live run, a CACHED replay labeled as such, or both (E3).

Go only if every box above is checked. If E1 or the load test cannot be done before the demo, ship the reduced version: corrected copy, elapsed time and the paused "Needs your answer" row in the tray, with no remaining-time range.
