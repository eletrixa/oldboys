# Context brief: run progress communication in oldboys (plans/015-run-progress)

Repo: /home/asajj/code/oldboys (Next.js 16 on Cloudflare Workers, Workflows, D1, R2). Read CLAUDE.md first.

## The ask (Robert, 2026-10-09)
"When the new search runs a new brief there needs to be more information in the square that is async when the user can
go over the website, and in the full-screen mode. We need to communicate so the user knows how much it takes."
- "the square that is async" = the run tray: `src/app/_components/run-tray.tsx` + `run-tray-store.ts` (docked card,
  bottom right, follows runs started in this tab while the recruiter browses other pages). Today it shows: candidate name,
  what it is hiring for, a status pill (Queued / Researching / Needs your answer / Brief ready / Failed), five step dots,
  "Open brief" link. No time, no ETA, no "what is happening now", no "what we found".
- "full-screen mode" = the run page while the research runs: `src/app/runs/[id]/run-view.tsx` (+ `parts.tsx`
  ProgressSteps, `state.ts` helpers). Today: header "Putting together <First>'s brief", a static line "Usually 2 to 4
  minutes. You can leave; the brief waits in My briefs and the tray at the bottom follows it." (WRONG: measured runs take
  3–8 min), a progress bar (percent = index of last finished recipe step / step count, which jumps around now that steps
  run in parallel pools), five human rows (Searching public sources / Making sure we have the right person / Reading
  their work history / Double-checking facts / Writing your brief), "Started N min ago", a cost line, the lineup
  question card when paused, a stalled notice after 30 min with no ledger activity.

## Data the client has (GET /api/runs/:id/state, polled every 2 s on the page, 4 s in the tray)
`RunState` (src/app/runs/[id]/state.ts): status queued|running|paused|done|failed; `step` = id of the LAST recipe step
that wrote a ledger row (not "currently running"); `step_index`/`step_count`; `mentions` = sources count; `candidates`
(lineup, decisions merge / possibly-same-as / rejected, platform); `created_at`; `last_at` (newest ledger ts);
`cost` = {usd, source_calls, llm_calls, duration_ms} (src/domain/run-cost.ts, pauses excluded); subject, headline, role,
position. The ledger (D1 `ledger_entries`: run_id, seq, ts, step, kind call|llm|decision|pause, cost_usd, ms, ref_json)
has one row per FINISHED step with its own duration `ms` and completion `ts`. There is NO row when a step starts.
Changing the ledger kind CHECK needs a migration (avoid).

## How a hiring run executes (src/workflow/research-run.ts, src/recipe/goals/hiring.ts)
seed_profile (LinkedIn scrape of the given URL, ~7 s) → role_template/role_questions → SEARCH POOL (serp_person,
social_serp, instagram_search, facebook_search, github_search; sliding window of 6 in parallel; SERP actors can hit a
45–90 s timeout) → resolve_lineup (Opus, ~7 s; may PAUSE with status `paused` until the recruiter answers the lineup,
unbounded human time, excluded from research time) → COLLECT POOL (linkedin_profile, linkedin_posts, employer_company,
github_profile, github_deep, github_apify, stackexchange, huggingface, orcid, openalex, x_profile, instagram_profile,
tiktok_profile, youtube_channel, facebook_page, bluesky, personal_site_crawl, role_sites_serp, cz_registries,
talks_serp, press_serp; parallel window of 6; budget 18 paid actor runs / $0.50) → extract_claims (Opus, ~25–36 s) →
verify_claims (~9–15 s) → synthesize_report (~40–84 s, max 254 s) → done.
Measured (plans/013-run-latency/01-BASELINE.md, prod, 10 runs): wall 144–604 s, typically 3–8 min without a human pause.
Per-step typical seconds: serp_person 20–40 (max 90), social_serp 26–36, press_serp 30–38, talks_serp 21–36,
role_sites_serp 4–35, youtube_channel 18–29, personal_site_crawl 18–24, x_profile 10–13, instagram_search 73 (1 run),
facebook_search 5, employer_company 5–10, linkedin_posts 5, instagram_profile 3–4, linkedin_profile 1.5–3,
cz_registries 1–2, github/orcid/openalex/bluesky/stackexchange/huggingface < 2, extract 25–36, verify 9–15,
synthesize 40–84, resolve 7, seed 6.5.
Phase 1 of plans/013 (parallel pools) shipped 2026-10-09 but is not measured live yet; phases 2–3 would cut to ~100 s
then ~60–75 s. So any ETA must be calibrated per step and must survive the recipe getting faster.

## Hard constraints
- Honesty is a judged criterion (10 %): no fake precision, no fake progress; label estimates as typical; say "longer than
  usual" instead of counting into negative time; CACHED / MOCK labels stay.
- Nothing that scores or judges the person. The tray and page show progress and findings counts only.
- Workflow code imports only src/domain and src/recipe; the UI never computes with the model; pure helpers in
  src/domain or src/app/runs/[id]/state.ts with Vitest tests next to them; no new interfaces with one implementation;
  Radar design tokens only (src/app/ui.tsx: CARD, Pill, LINK, Eyebrow; colours ok/action/conflict/unsure/muted).
- `pnpm check` (typecheck + strict lint + tests) must pass; every user-visible change gets a CHANGELOG.md line.
- Polling stays (no SSE on the page); the state route is open (unguessable id), keep its payload small-ish.
- Tray rules: never blocks the page, fixed and narrow (22rem), hidden on /apply pages and on the run page of the only run
  it holds, keyboard reachable.

## Users
Recruiters / hiring managers (Czech market, often on a laptop, sometimes a phone), who start one run from the start form
or 1–20 runs at once from a position's candidate pool (plans/010), then either wait on the run page or browse other
positions while the tray follows the runs. They must answer the lineup question when the run pauses (status `paused`),
otherwise the run waits forever (well, until they come back).

## Candidate directions already identified (architecture options to steelman)
A. "Do less": fix the copy ("Usually 3 to 8 minutes"), add elapsed time and a progress bar to the tray. No backend.
B. Client-side phase model: the page/tray map the five human rows to typical durations and compute an ETA range from
   elapsed time and which row is active. No route change; ETA ignores which steps actually remain.
C. Ledger-projected progress (lean): the state route adds `steps_done: string[]` (recipe step ids with a ledger row);
   a pure domain module `src/domain/run-eta.ts` holds a typical-duration table per step id (from the baseline) and
   derives: time-weighted progress share, the remaining-time range (parallel pools counted as max/window, tail serial),
   the current phase, the sources still to read (by human label). Client ticks a 1 s local clock between polls so
   elapsed/remaining move smoothly. Tray and page share the same projection. No migration.
D. Server-recorded step starts + SSE push + per-role historical calibration (median wall of past runs of the same role
   family from D1): most accurate, needs a migration (ledger kind 'start' or a new table), SSE wiring in the tray, and a
   query per poll; heaviest.
