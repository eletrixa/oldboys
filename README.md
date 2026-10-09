# oldboys — Social Media Deep Research (Hackathon Case 01, Apify)

Hackathon build. Live at https://oldboys.asajj.cz (Cloudflare Workers).

- `docs/brief.md` — the assignment
- `docs/01-brainstorm.md` — ideas, top 5
- `docs/02-discovery.md` — users per goal, source landscape, assumptions, experiments
- `docs/03-pre-mortem.md` — what kills it at sunrise, mitigations
- `plans/001-deep-research-arch/` — architecture dossier; start at `00-SYNTHESIS.md`
- `overview/index.html` — one-page overview; `cd overview && python3 -m http.server 4242`

Status: 2026-10-08 evening. Screen 1 (start) and Screen 2 (checking + lineup) work against the local Workflow; every hiring source is a live collector; brief generation needs `ANTHROPIC_API_KEY`.

## What it does
Type a candidate's name, a city or profile link, and the role. The Worker runs one declared recipe (`src/recipe/goals/hiring.ts`): Google SERP, a social-profile SERP, identity lineup (pauses and asks you at most three yes / no / not sure questions), then LinkedIn profile and posts, the current employer's LinkedIn company page, GitHub, Stack Exchange, Hugging Face, ORCID, OpenAlex, X, Instagram, TikTok, YouTube, a public Facebook page, Bluesky, the personal site, a talks and articles search and a press, awards and community search. Claims are extracted with the primary model, verified deterministically (quote must sit inside a stored excerpt) and by a second model that can only downgrade, then written into a brief cut into evidence-backed sections (current role, employer context, career history, education, public code, talks and podcasts, writing and publications, press coverage, social presence, community and awards, location, where sources disagree, plus one per role must-have) with interview questions and an explicit "not searched" list.

Recruiter flow (plans/012): log in and `/` is your briefs. **New brief** (`/briefs/new`) is one page in three steps: pick a position (search the team's positions, create one from the role catalog with its must-haves, or from a posting), add candidates (one row each: LinkedIn profile, pasted CV or a PDF / text CV file, plus tick people already in the position's pool), then **Research N candidates** adds the new rows to the pool and starts one run each in a single enrich call (hourly caps answer with a calm message and keep the rows). You land on the position's results table.

What is live, what is not:
- Apify actors and REST sources: live (`src/recipe/sources/*`, verified with `LIVE=1 ... vitest run live-sources`).
- Role questions and identity scoring: model calls with a deterministic fallback. Without a model the lineup never merges on its own, it only asks.
- Extract, verify, brief: model calls only. Without `ANTHROPIC_API_KEY` the run stops after the lineup and Screen 2 shows the failing step.
- Verification phone calls (plans/005): `CALL_PROVIDER=mock` unless ElevenLabs keys are set; mock output is labeled MOCK.
- Limits: no reverse image search; Facebook is collected only for a confirmed Facebook candidate, through the public pages scraper (page fields, never email or phone); ISIR and Companies House are "not searched" with a reason; LinkedIn needs a public `/in/` URL from search or the form; a nightly cron (`src/workflow/purge.ts`, 03:00 UTC) deletes every run older than 7 days: raw payloads in R2, sources, claims, candidates, gaps, brief, calls, ledger and the run row.

## Validation and honest limitations
**Eval set: caught 84 of 95 checks** on five synthetic candidates with a simulated recruiter answering the identity lineup (0 unsafe misses, 11 conservative); **strict, nobody answers: 84 of 95**; **0 lineup questions asked**, because every persona starts from a profile or CV and such runs never pause. Full table: [`eval/RESULTS.md`](eval/RESULTS.md); in the app: `/validation` (public, linked from the footer).

- What it is: five fictional people (`eval/personas/`, handles `evalp-*`, pages on `example.*`) with traps written in advance (namesakes in another and in the same city, a forked repo, a quote not in its source, hedged wording, a CV that differs from LinkedIn, a CV-only quote, course homework, 2016 evidence, an alias "contradiction", an AI outage) and a hand-written ground truth. `eval/harness.ts` runs each one through the real seams (seed -> SERP -> resolve -> GitHub / Stack Exchange -> identity pass -> extract -> verify incl. devil's advocate -> synthesize) with replayed ports: no network, no keys.
- Lineup: a profile merges on its own only on a strong link (the given profile, a confirmed employer, a cross-link), never on name + city; a weaker match stays "possibly the same person". The run pauses with "is this the same person?" (at most 3 questions) only when nothing is confirmed. Where the product asks, the eval answers from the ground truth through the same path as a real answer (`lineupNeedsAnswer`, `questionsToAsk`, then the decisions and the source identity pass), never where it does not ask and never over a profile the product merged or rejected by itself; it is always right, a real recruiter can be wrong. The strict score shows the run with no answer. Before the "no lineup pause with a given profile" change (24cb73b) the same eval asked 8 questions and scored 92 of 95.
- Run: `pnpm eval` prints the table and rewrites `eval/results.json` + `eval/RESULTS.md`. `pnpm check` runs the same eval (`eval/__tests__/eval.test.ts`) and fails when a check that passes today starts to miss in either score, on any unsafe miss, or when the lineup asks more questions. Fix the pipeline, never the truth.
- Known misses (all conservative, the same in both scores): the own GitHub profiles of p1 (Brno) and p4 (Plzeň) match only on name + city, so they stay "possibly the same person", the run does not ask, and their repo facts are not used; a CV statement quoted only from the CV is shown as "differs" instead of "not found publicly"; a claim that overstates a true source ("40 studies") is downgraded whole, so the true must-have shows as partial.
- The eval found and fixed two bugs: on CV runs the pasted CV itself was sent to the identity model as a lineup hit; a same-name GitHub account in the same city was merged on name + city alone (3 unsafe misses), so its firmware repo became a FACT. Name + city now caps at "possibly the same person"; a merge needs the given profile, a confirmed employer or a cross-link.

Real: live public search and profiles through Apify and public APIs; every finding links to its source and is a FACT only when its quote is in the saved text and verify passed; the given LinkedIn profile or CV is the confirmed person, namesakes wait for the recruiter; intake by email, apply page, form API and StartupJobs; 7-day purge, delete now, audit record and data export; phone verification through ElevenLabs + Twilio when switched on (answers are STATEMENTs, never FACTs).

Simulated (labelled in the app with one `SimulatedPill`): **MOCK** phone call with `CALL_PROVIDER=mock` (canned answers, $0); **CACHED** finished brief opened 30+ minutes later (stored copy, nothing fetched again); **NO AI** brief when the summary model is unavailable (confirmed evidence and template questions only); the eval personas and their recorded model answers; the landing page sample brief (a fictional candidate, marked "fictional example"); ARES company lookups at sign-up served from a stored copy.

Incomplete: no eval on real, consenting people with written ground truth yet (only the qualitative reviews in `eval/reviews/`); the eval measures rules and wiring, not the live model's judgement, and its lineup answers are simulated and always right; no ATS write-back ("Copy for ATS" and the `.ics` invite are copy / download only); Facebook profiles not opened; the known misses above.

## Quickstart
```sh
pnpm install
pnpm hooks:install            # pre-commit runs pnpm check on code changes
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev                      # UI + API on :3141 (Workflows are NOT available here)
pnpm preview                  # full stack incl. the research Workflow on :8787 (use this for a real run)
```

Put `APIFY_TOKEN`, `ANTHROPIC_API_KEY` and `RUN_TOKEN` into `.dev.vars`. The start form posts to `/api/start`, which adds the bearer server-side and is capped at 6 runs per hour; every other client calls `POST /api/runs` with `Authorization: Bearer <RUN_TOKEN>` (20 per hour).

Live checks (spend real Apify money, never in CI):
```sh
LIVE=1 SUBJECT="Jozef Buryan" ANCHOR="Praha" REPORT=/tmp/r.txt pnpm exec vitest run live-sources   # every collector, ~$0.01
node scripts/ui-flow.mjs "Jozef Buryan" "Praha" "Senior Data Engineer" /tmp/shots                  # Screen 1 -> 2 in Chromium against :8787
```
CEO review loop: each iteration grades the screenshots and a live run into `eval/reviews/NNN.md`; fixes land as `fix: review NNN` commits until the score is at least 4.5 / 5.

## Deploy
```sh
wrangler login
wrangler r2 bucket create oldboys-sources
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put APIFY_TOKEN
wrangler secret put RUN_TOKEN           # bearer token required by POST /api/runs
pnpm db:migrate:remote   # run by hand BEFORE pushing a new migration; CI cannot (no D1 scope on its token)
pnpm deploy              # or just push to main: .github/workflows/deploy.yml deploys
```

## Links
- `rules/` — coding rules for this repo (start at `rules/README.md`)
- `plans/002-cloudflare-platform/` — binding platform decision
