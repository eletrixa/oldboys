## Discovery Plan: run progress communication

Round 2 of plans/015-run-progress. Inputs: `evidence/context.md`, `src/app/_components/run-tray.tsx` (polls every 4 s), `src/app/runs/[id]/run-view.tsx` (polls every 2 s, static line "Usually 2 to 4 minutes"), `plans/013-run-latency/01-BASELINE.md` (10 finished prod runs).

### Discovery question

Can we tell a recruiter, in the tray and on the run page, how long a brief will take and what is happening now, honestly enough that they trust the number, leave the page when they want to, and come back when the run needs their answer?

Honesty is a judged criterion (10 %), so a wrong or falsely precise number costs more than no number.

### Facts the plan leans on

- Wall clock of the 10 baseline runs: 144 to 604 s. Without a human pause: 189 to 484 s, roughly 3 to 8 min. The page copy says 2 to 4 min, so it is wrong today.
- Four of the 10 baseline runs ran under 200 s, but the median is about 280 s, and the largest single swings are one timed-out `serp_person` (90 s, twice) and a long `synthesize_report` (up to 169 s).
- LLM tail (extract, verify, synthesize) was 56 % of the CEO run (272 of 484 s). It is the least predictable part.
- Ledger has one row per finished step, none at step start. So "current step" cannot be read, only "which steps are done".
- Plan 013 phase 1 is shipped but not measured. Phases 2 and 3 aim for about 100 s then 60 to 75 s. Any step table goes stale.
- The tray polls every 4 s, the page every 2 s. Between polls nothing moves.
- Lineup pause has unbounded human time and is excluded from research time.

### Ideas explored (short)

| Id | Idea | One line |
|---|---|---|
| A | Do less | Fix the copy to "3 to 8 minutes", add elapsed time and a bar to the tray. No backend. |
| B | Client phase model | Five human rows get typical durations, ETA from elapsed time and active row. |
| C | Ledger projection (lean) | State route adds `steps_done`; pure `src/domain/run-eta.ts` holds typical seconds per step id and derives progress share, remaining range, phase and unread sources. |
| D | Recorded starts plus SSE plus calibration | Server records step starts, pushes events, calibrates per role family from past runs. Needs a migration. |
| 1 | Remaining-time range | "about 2 to 4 min left", from per-step typical durations. |
| 2 | "What we are reading now" | Lists the sources still to read in the current phase. |
| 3 | "Found so far" strip | N public mentions, M confirmed profiles. |
| 4 | "Needs your answer" call to action | Prominent in the tray when the run is paused. |
| 5 | 1 s local ticker | Elapsed and remaining move between polls. |
| 6 | "Taking longer than usual" | Shown once elapsed passes the p90 of the phase, never a negative countdown. |

### Critical assumptions

Impact and Uncertainty are High / Medium / Low. Priority combines both: P1 test first, P2 test if time, P3 accept or defer. **LoF** marks a leap-of-faith assumption: if it is false, the idea fails or becomes dishonest.

| # | Assumption | Category | Impact | Uncertainty | Priority |
|---|---|---|---|---|---|
| A1 | **LoF.** A per-step typical-duration table can produce a remaining-time range that contains the real remaining time in at least 80 % of polls, with only 10 baseline runs and heavy-tailed steps (serp_person 20 to 90 s, synthesize 40 to 169 s). | Feasibility | High | High | P1 |
| A2 | **LoF.** Recruiters read "about 2 to 4 min left" as a typical estimate and are not annoyed or misled when a run overshoots. Honest wording ("usually", "longer than usual") is enough to protect trust. | Value | High | High | P1 |
| A3 | **LoF.** The table stays accurate after plan 013 phases 2 and 3 make the recipe 2 to 4 times faster, or can be recalibrated cheaply from the ledger (one script, under 30 minutes). | Viability | High | High | P1 |
| A4 | **LoF.** A paused run is answered sooner when the tray shows a prominent "Needs your answer" action than with today's small pill. Otherwise runs sit idle until the recruiter happens to return. | Value | High | Medium | P1 |
| A5 | `steps_done` (recipe step ids with a ledger row) is enough to tell which phase is active and which sources are still unread, even though parallel pools finish out of order and a step that is running has no row. | Feasibility | High | Medium | P1 |
| A6 | Showing the sources still to read does not mislead: the list reflects the recipe's declared steps (including `onEmpty` branches and skipped steps for non-technical roles), not steps that will never run. | Feasibility | Medium | Medium | P2 |
| A7 | The "found so far" counts (mentions, confirmed profiles) rise steadily enough to feel like progress. They may sit at 0 during the 90 s SERP wait, which reads as stuck. | Usability | Medium | High | P1 |
| A8 | Counts of mentions and confirmed profiles are never read as a verdict on the person (brief forbids scores). More mentions is not "better". | Viability | High | Low | P3 |
| A9 | A 1 s local ticker on page and tray costs no visible jank, no battery or layout shift, and does not break `prefers-reduced-motion` or screen readers (no live-region spam every second). | Usability | Medium | Medium | P2 |
| A10 | The tray card stays readable at 22rem and at 390 px width with a status line, range, source line and an action, with up to 20 runs from a pool enrich, without covering page content or hiding the last button. | Usability | Medium | Medium | P2 |
| A11 | The range shape (width and wording) matters: a range wider than about 2.5x its lower bound reads as "no idea" and is ignored. A narrow range that is often wrong is worse. | Usability | High | Medium | P1 |
| A12 | "Taking longer than usual" after the phase p90 is rare enough (under 10 % of baseline phases) to keep its meaning, and the message is calming rather than alarming. | Usability | Medium | Medium | P2 |
| A13 | Recruiters actually leave the page when told how long it takes and the tray follows. The real problem today is uncertainty, not duration itself. | Value | Medium | Medium | P2 |
| A14 | Adding `steps_done` to the state payload keeps it small (under 1 KB extra) and does not raise D1 read cost noticeably at 20 runs polled every 4 s. | Feasibility | Low | Low | P3 |
| A15 | The lineup pause must be excluded from elapsed and remaining. A recruiter who answers after 10 minutes must not see "took 14 min" or a stale range. | Feasibility | Medium | Low | P3 |
| A16 | Direction D's recorded starts add accuracy beyond C that is visible to users (for example range hit rate rises from about 80 % to 90 %), enough to justify a migration under hackathon time. | Viability | Medium | High | P2 |
| A17 | CACHED and MOCK runs show correct progress or none: a replayed ledger finishes in seconds and must not show an ETA. | Usability | Low | Low | P3 |

Reading: A1, A2, A3, A4 are the four leap-of-faith assumptions. A5, A7 and A11 are close behind because they decide whether C can ship at all. A16 decides whether D is worth any time.

### Validation experiments

Effort: S under 1 h, M 1 to 3 h, L half a day. Timeline counts from the start of the experiment.

| # | Tests assumption | Method | Success criteria | Effort | Timeline |
|---|---|---|---|---|---|
| E1 | A1, A11, A15 | Replay: read the ledger of the 10 baseline runs, rebuild `steps_done` at every 2 s tick, run the estimator, compare the shown range to the true remaining time. Use leave-one-out calibration (table built from the other 9 runs) so the test is not self-fulfilling. | See acceptance thresholds. Containment in at least 80 % of polls; no lower bound more than 2x the true remaining time; range upper/lower ratio at most 2.5 on at least 90 % of polls. | M | Day 1, 2 h |
| E2 | A5, A6 | Unit test the pure module with fixtures: parallel pool finishing out of order, technical vs non-technical role (github steps absent), `onEmpty` branch, paused run. Phase and "still to read" list must match the recipe for each fixture. | 100 % of fixtures correct; unread list never names a step that the recipe will not run for that role family. | S | Day 1, 1 h |
| E3 | A4, A2, A7, A11 | Hallway test with a scripted run: a mock ledger plays a 5 min run (including a 60 s zero-mentions stretch, one overshoot, one lineup pause) behind the real UI. 5 recruiters, A/B within subject: current UI versus the new tray and page. Task: "do your other work, tell me when you think the brief is ready". Measure behavior: time from pause to first click on the answer, whether they left the page, whether they said "stuck". | Median time from pause to answer at least 40 % shorter than today; at least 4 of 5 find the Needs your answer action without help; at most 1 of 5 says the page is stuck during the zero-mentions stretch; after the overshoot at most 1 of 5 says the estimate was a lie. | L | Day 2, 3 h incl. 5 sessions of 20 min |
| E4 | A10, A9 | Playwright at 390 px and 1280 px with the tray holding 1, 3 and 20 mock runs, paused and running states. Assert no horizontal scroll, tray width at most 22rem or viewport minus 2rem, every button reachable by Tab, tap targets at least 44 px, last page button scrollable above the tray, no layout shift above 0.02 across a 30 s ticker run. | All assertions pass at both widths; screenshots reviewed once. | M | Day 2, 2 h |
| E5 | A9 | Reduced-motion and a11y check: emulate `prefers-reduced-motion: reduce`, confirm no pulsing dots and no animated bar; confirm the 1 s ticker text is not inside an `aria-live` region (only phase changes and pause announce, polite); run a screen-reader pass with the browser accessibility tree snapshot. | Zero animation under reduce; at most 1 live announcement per phase change; ticker never announces. | S | Day 2, 1 h |
| E6 | A9, A14 | Performance spike: run the ticker plus 20 tray pollers for 5 min in Chromium with a trace. Count main-thread work per second and requests per minute; measure state payload size with and without `steps_done`. | Ticker work under 2 ms per tick; no more than 15 requests per minute per run (4 s poll); extra payload under 1 KB; no memory growth above 5 MB over 5 min. | S | Day 2, 1 h |
| E7 | A3 | Recalibration drill: take the post-013 runs (or synthetic runs with all durations scaled by 0.4), rebuild the table with the script the estimator ships, and re-run E1. Time the whole drill. | Table regenerated from ledger in under 30 minutes of human time; E1 thresholds still met on the new data; or the UI falls back to no range (see decision framework). | M | Day 3, 2 h; repeat after each 013 phase |
| E8 | A12 | Replay the 10 runs and count phase overshoots: for each phase, how often did elapsed pass the phase p90 before the phase ended. | Overshoot message would fire in at most 10 % of phases and in at most 3 of 10 runs; and in every run that did take over 8 min it fires at least once. | S | Day 1, 30 min (extends E1 script) |
| E9 | A16 | Technical spike for D: estimate the cost of a `start` ledger kind or table (migration, workflow edit, D1 query per poll). Replay E1 with the best possible oracle (exact current step) to get the accuracy ceiling. | If oracle containment beats C by under 8 points, D is not justified; record the number. | M | Day 3, 2 h |
| E10 | A17, A15 | Integration check on the preview app: a CACHED replay, a MOCK run, a run paused for 10 min, a failed run, a stalled run. | CACHED shows no ETA and the CACHED label; paused run freezes elapsed and shows Needs your answer; failed and stalled keep their existing notices. | S | Day 3, 1 h |

### Experiment details

**E1, ledger replay (the gate for the whole feature).**
Build a script in the scratchpad that loads `ledger_entries` for the 10 baseline runs (read-only prod query already used by plan 013) and, for each run, generates a poll at every 2 s from the first row to the last. At each poll it computes the set of finished steps from rows with `ts` up to that moment, feeds the pure estimator, and records the shown low and high remaining seconds. The truth is `last_ts - poll_ts`, minus any pause time. Report: containment rate overall, per run and per phase (search, identify, collect, write); worst lower-bound overshoot; range ratio; first-poll behavior (the first 15 s may show "Starting" rather than a range, which is allowed). Run the leave-one-out version only for the decision, never the in-sample version. With n = 10 the result is a screen, not a proof, so also report the worst run and do not hide it.

**E3, scripted hallway test.**
Use a fixed script so every recruiter sees the same run: 0 to 90 s search with zero mentions, lineup pause at 150 s, resume, overshoot of the writing phase by 90 s, done at 6 min. Condition order alternates. Behavior is observed, not asked. After the task ask only two things: "when did you think it would be done" and "was there a moment you thought it was broken". Record the answers verbatim. A tester who answers the lineup earlier than the control by 40 % is the main signal. Participants: five recruiters or hiring managers from Robert's network; one on a phone.

**E4 and E5, Playwright and reduced motion.**
Use the existing `pnpm --filter oldboys-extension e2e` setup as a pattern, but run against the Next preview on port 8790 (see the local QA loop memory). Seed the tray through `sessionStorage` with ids of mock runs served by a stub state route. States covered: queued, running with range, running with overshoot, paused, done, failed. This is also where the dark-pattern risk is checked: the paused action must be a real link to the run page, not a modal.

**E7, recalibration.**
The estimator ships with a small script that turns ledger rows into the typical-duration table (median and p90 per step id, per run kind). The drill proves the script exists, is documented in `docs/ops`, and that the UI degrades safely (see decision framework) when the table is older than the recipe.

### Acceptance thresholds (summary)

| Measure | Threshold |
|---|---|
| Range contains true remaining time (leave-one-out, all polls after the first 15 s) | at least 80 % |
| Lower bound exceeds true remaining by more than 2x | never (0 polls) |
| Upper bound / lower bound | at most 2.5 on at least 90 % of polls |
| "Longer than usual" fires | at most 10 % of phases, at most 3 of 10 runs |
| Time from pause to recruiter answer | at least 40 % shorter than today (median, 5 recruiters) |
| Recruiters who call the page stuck during a zero-mentions stretch | at most 1 of 5 |
| Layout | no horizontal scroll at 390 px and 1280 px; tap targets at least 44 px; layout shift at most 0.02 |
| Reduced motion | no animation; ticker never announced |
| Payload and polling | extra payload under 1 KB; no extra requests beyond today's polls |
| Recalibration | under 30 minutes of human time |

### Decision framework

- **If E1 passes** (80 % containment, no 2x lower-bound miss): ship idea 1 with direction C.
- **If E1 fails on containment but the worst lower-bound miss is under 2x**: widen the range (use p25 to p90 instead of p10 to p75) and re-run once. If the ratio then exceeds 2.5, drop the range and show phase plus elapsed plus "usually 3 to 8 minutes" (direction A with the phase line).
- **If a lower bound ever exceeds 2x the truth** (the UI promised the brief was far away when it was near): this is a hard fail for the range. Show only elapsed time and the phase until fixed. Never ship a known over-promising lower bound.
- **If E7 shows recalibration takes more than 30 minutes or the table fails after a 013 phase**: ship the range behind a table version check. When the ledger shows steps the table does not know, the range hides and the copy falls back to elapsed time plus the phase.
- **If E3 shows pause-to-answer improves less than 40 % but the Needs your answer action is found by 4 of 5**: keep it (it is cheap) and look at notification options (browser tab title, favicon badge) as the next experiment. If fewer than 4 of 5 find it, redesign the tray row before shipping anything else.
- **If E3 shows 2 or more of 5 read the page as stuck during the zero-mentions stretch**: drop the "found so far" counts as the only progress signal and lead with the phase and the sources being read; show counts only once above zero.
- **If 2 or more of 5 say the estimate was a lie after the overshoot**: change wording from a range to "usually X to Y min" and add the overshoot message earlier, or remove the estimate and keep phase text.
- **If E4 or E5 fails**: fix layout and motion before any other work. Reduced-motion and 390 px are release blockers, not polish.
- **If E6 fails** (jank or request growth): drop the 1 s ticker in the tray, keep it on the page only, and tick the tray on the 4 s poll.
- **If E9 shows the oracle beats C by under 8 points**: close direction D for this hackathon and record the number in the dossier. If it beats C by 8 points or more and the migration plus workflow edit fits in half a day, reopen D for after the demo.
- **Always**: ship Direction A's copy fix ("3 to 8 minutes", from the baseline) first and on its own, since the current line is wrong regardless of what else is decided.
