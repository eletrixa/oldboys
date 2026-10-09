# Radar by Old Boys

**A research assistant for recruiters. It reads the public web about a candidate, shows you the evidence, and leaves the judgement to you.**

Built in one night at From Dusk Till Dawn Hackathon #01 in Prague for Case 01, "Social media deep research" (Apify). Live at https://oldboys.asajj.cz on Cloudflare Workers.

> **On the jury?** Start with [JURY.md](JURY.md). It covers what Radar does, how to try it in three minutes, and how it maps to the judging criteria.

## Why we built it

A recruiter who wants to know a candidate before the interview opens ten tabs, skims half of them, and still cannot tell which Jana Nováková they are reading about. Radar does the reading for you and keeps the receipts. Every line in the brief links to where it came from. A line is called a FACT only when its quote sits word for word in the saved source text. Everything else is marked as an inference or an open question. The tool researches. It never judges.

## What it does

Give it a position and a candidate (a LinkedIn link or a CV). In about two to four minutes you get a brief built from public sources: what the candidate has done, what backs each must-have of the role, what does not match, and what to ask at the interview.

Under the hood, one declared recipe (`src/recipe/goals/hiring.ts`) runs the search. It starts with Google and a social-profile search, then an identity lineup that pauses and asks you at most three yes / no / not sure questions when it is unsure who is who. Then it reads the LinkedIn profile and posts, the current employer's LinkedIn company page, GitHub, Stack Exchange, Hugging Face, ORCID, OpenAlex, X, Instagram, TikTok, YouTube, a public Facebook page, Bluesky, the personal site, a talks and articles search, and a press, awards and community search.

The primary model extracts claims. Each claim is checked twice: deterministically (the quote must sit inside a stored excerpt) and by a second model that can only downgrade, never promote. What survives goes into a brief cut into evidence-backed sections: current role, employer context, career history, education, public code, talks and podcasts, writing and publications, press coverage, social presence, community and awards, location, where sources disagree, plus one section per must-have of the role. You also get interview questions and an explicit list of what was not searched.

### The recruiter flow

Log in and `/` is your briefs. **New brief** (`/briefs/new`) is one page in three steps:

1. Pick a position. Search the team's positions, create one from the role catalog with its must-haves, or build one from a job posting.
2. Add candidates, one row each: a LinkedIn profile, a pasted CV, or a PDF / text CV file. You can also tick people already in the position's pool.
3. Click **Research N candidates**. New rows join the pool and one run starts per candidate in a single enrich call. If you hit an hourly cap, you get a calm message and the rows stay put.

You land on the position's results table and watch the briefs come in. (Design dossier: plans/012.)

### What is live and what is not

- Apify actors and REST sources are live (`src/recipe/sources/*`, verified with `LIVE=1 ... vitest run live-sources`).
- Role questions and identity scoring are model calls with a deterministic fallback. Without a model the lineup never merges on its own. It only asks.
- Extract, verify and the brief are model calls only. Without `ANTHROPIC_API_KEY` the run stops after the lineup and Screen 2 shows the failing step.
- Verification phone calls (plans/005) use `CALL_PROVIDER=mock` unless ElevenLabs keys are set. Mock output is labeled MOCK.
- Limits we chose or hit: no reverse image search. Facebook is collected only for a confirmed Facebook candidate, through the public pages scraper (page fields, never email or phone). ISIR and Companies House are listed as "not searched" with a reason. LinkedIn needs a public `/in/` URL from search or the form. A nightly cron (`src/workflow/purge.ts`, 03:00 UTC) deletes every run older than 7 days: raw payloads in R2, sources, claims, candidates, gaps, brief, calls, ledger and the run row.

Status as of the evening of 2026-10-08: Screen 1 (start) and Screen 2 (checking + lineup) work against the local Workflow, every hiring source is a live collector, and brief generation needs `ANTHROPIC_API_KEY`.

## How we test it, and where it still falls short

The eval set caught 84 of 95 checks on five synthetic candidates with a simulated recruiter answering the identity lineup (0 unsafe misses, 11 conservative). Strict mode, where nobody answers, also scores 84 of 95. The lineup asked 0 questions, because every persona starts from a profile or CV and such runs never pause. The full table is in [`eval/RESULTS.md`](eval/RESULTS.md) and in the app at `/validation` (public, linked from the footer).

The five people are fictional (`eval/personas/`, handles `evalp-*`, pages on `example.*`). Each one carries traps written in advance: namesakes in another city and in the same city, a forked repo, a quote that is not in its source, hedged wording, a CV that differs from LinkedIn, a CV-only quote, course homework, evidence from 2016, an alias "contradiction", and an AI outage. A hand-written ground truth says what the right answer is. `eval/harness.ts` runs each persona through the real seams (seed -> SERP -> resolve -> GitHub / Stack Exchange -> identity pass -> extract -> verify incl. devil's advocate -> synthesize) with replayed ports. No network, no keys.

How the lineup behaves: a profile merges on its own only on a strong link (the given profile, a confirmed employer, a cross-link). Name plus city is never enough, and such a match stays "possibly the same person". The run pauses with "is this the same person?" (at most 3 questions) only when nothing is confirmed. Where the product asks, the eval answers from the ground truth through the same path as a real answer (`lineupNeedsAnswer`, `questionsToAsk`, then the decisions and the source identity pass). It never answers where the product does not ask, and never over a profile the product merged or rejected by itself. The simulated recruiter is always right. A real one can be wrong, which is what the strict score shows. Before the "no lineup pause with a given profile" change (24cb73b) the same eval asked 8 questions and scored 92 of 95.

Running it: `pnpm eval` prints the table and rewrites `eval/results.json` + `eval/RESULTS.md`. `pnpm check` runs the same eval (`eval/__tests__/eval.test.ts`) and fails when a check that passes today starts to miss in either score, on any unsafe miss, or when the lineup asks more questions. Fix the pipeline, never the truth.

Known misses, all conservative and the same in both scores: the own GitHub profiles of p1 (Brno) and p4 (Plzeň) match only on name plus city, so they stay "possibly the same person", the run does not ask, and their repo facts are not used. A CV statement quoted only from the CV shows as "differs" instead of "not found publicly". A claim that overstates a true source ("40 studies") is downgraded whole, so the true must-have shows as partial.

The eval also found and fixed two bugs. On CV runs the pasted CV itself was sent to the identity model as a lineup hit. And a same-name GitHub account in the same city was merged on name plus city alone (3 unsafe misses), so its firmware repo became a FACT. Name plus city now caps at "possibly the same person". A merge needs the given profile, a confirmed employer or a cross-link.

**Real:** live public search and profiles through Apify and public APIs. Every finding links to its source and is a FACT only when its quote is in the saved text and verify passed. The given LinkedIn profile or CV is the confirmed person, and namesakes wait for the recruiter. Intake by email, apply page, form API and StartupJobs. A 7-day purge, delete now, an audit record and data export. Phone verification through ElevenLabs + Twilio when switched on (answers are STATEMENTs, never FACTs).

**Simulated,** each labelled in the app with one `SimulatedPill`: a **MOCK** phone call with `CALL_PROVIDER=mock` (canned answers, $0). A **CACHED** finished brief opened 30+ minutes later (stored copy, nothing fetched again). A **NO AI** brief when the summary model is unavailable (confirmed evidence and template questions only). The eval personas and their recorded model answers. The landing page sample brief (a fictional candidate, marked "fictional example"). ARES company lookups at sign-up served from a stored copy.

**Incomplete:** no eval yet on real, consenting people with written ground truth, only the qualitative reviews in `eval/reviews/`. The eval measures rules and wiring, not the live model's judgement, and its lineup answers are simulated and always right. No ATS write-back ("Copy for ATS" and the `.ics` invite are copy / download only). Facebook profiles are not opened. Plus the known misses above.

## Run it yourself

```sh
pnpm install
pnpm hooks:install            # pre-commit runs pnpm check on code changes
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev                      # UI + API on :3141 (Workflows are NOT available here)
pnpm preview                  # full stack incl. the research Workflow on :8787 (use this for a real run)
```

Put `APIFY_TOKEN`, `ANTHROPIC_API_KEY` and `RUN_TOKEN` into `.dev.vars`. The start form posts to `/api/start`, which adds the bearer server-side and is capped at 6 runs per hour. Every other client calls `POST /api/runs` with `Authorization: Bearer <RUN_TOKEN>` (20 per hour).

Live checks spend real Apify money, so they never run in CI:

```sh
LIVE=1 SUBJECT="Jozef Buryan" ANCHOR="Praha" REPORT=/tmp/r.txt pnpm exec vitest run live-sources   # every collector, ~$0.01
node scripts/ui-flow.mjs "Jozef Buryan" "Praha" "Senior Data Engineer" /tmp/shots                  # Screen 1 -> 2 in Chromium against :8787
```

CEO review loop: each iteration grades the screenshots and a live run into `eval/reviews/NNN.md`. Fixes land as `fix: review NNN` commits until the score is at least 4.5 / 5.

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

## Read more

- `docs/brief.md` is the assignment.
- `docs/01-brainstorm.md` has the ideas and the top 5.
- `docs/02-discovery.md` covers users per goal, the source landscape, assumptions and experiments.
- `docs/03-pre-mortem.md` asks what kills it at sunrise, and how we guard against it.
- `plans/001-deep-research-arch/` is the architecture dossier. Start at `00-SYNTHESIS.md`.
- `plans/002-cloudflare-platform/` is the binding platform decision.
- `rules/` holds the coding rules for this repo. Start at `rules/README.md`.
- `overview/index.html` is a one-page overview: `cd overview && python3 -m http.server 4242`.
