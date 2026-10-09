# 17 — Discovery: GitHub deep scrape for technical roles

**Date**: 2026-10-09

**Product Stage**: existing product (hiring recipe live, position-bound runs, role catalog with a `family` per template)

**Discovery Question**: When the role is engineering or data, will a numbers-first "Code contributions" section (lines, commits, PRs merged into other people's repos, languages, active span) change what a Czech recruiter or hiring manager decides, can it be built from free GitHub REST plus one paid Apify actor inside the $0.50 / 16-call budget, and can every number stay traceable to a source excerpt without turning into a ranking of the person?

---

## Problem framing

Today `github_profile` (`src/recipe/sources/github.ts`) stores one user excerpt and the 10 most recently pushed repos. That answers "does a GitHub account exist" and "which repos", not "how much and what kind of code does this person actually write".

- Recruiters at Czech companies mostly are not engineers. They cannot judge a repo list, so they fall back to stars and follower counts, which reward visibility, not work.
- Hiring managers do read code, but a 10-repo list hides the main signal: contribution to other people's projects (PRs merged elsewhere) is the strongest public evidence of collaboration and review survival, and the list never shows it.
- The current excerpt cannot support quantitative claims, so the brief says "has a GitHub" and stops. For engineering roles that is the thinnest section of the brief where the evidence is richest.
- Risk on the other side: raw numbers invite false precision. Lines of code reward verbosity, private work is invisible, forks and squash-merges distort counts. A feature that prints big numbers without caveats damages the honesty score (10) and the product's core promise (FACT vs INFERENCE, gaps stated).

## Users and jobs to be done

| User | Job (when / I want / so I can) | Success looks like |
|---|---|---|
| Recruiter, Czech scale-up or agency, non-technical | When a developer candidate arrives, I want a plain-language summary of their public code output with links, so I can decide who goes to the technical screen without asking an engineer for a favour | Shortlists 1 in 3 fewer candidates for a technical interview with no regret; forwards the section to the hiring manager |
| Hiring manager / tech lead | When I open the brief, I want to see merged PRs into other people's repos, main languages and activity span, so I can pick the 2 or 3 things to probe in the interview | Interview questions reference specific repos or PRs from the card |
| Candidate (indirect) | I want my public work read fairly, with private and employer-closed work not counted against me | Card states "private contributions invisible"; no score, no rank |

Primary JTBD: cut the cost of the first technical screen. Not: rank developers, predict performance, or replace a code review.

## Ideas carried forward

From `docs/16-github-deep-brainstorm.md` (ids refer to that doc):

| Idea | Rationale |
|---|---|
| A (15, 16, 24). New collector `rest/github-deep` as step `github_deep` after `github_profile`, skipped unless `StepContext.roleFamily` is engineering or data | Reuses the collector contract; the skip becomes an honest "not searched: role is not technical" gap, no cost for non-tech roles |
| B (20). Fan out over every merged GitHub candidate (not just the first), max ~12 REST requests per handle | The pasted profile can link several accounts (personal, work); merged identity keeps it namesake-safe via `identityFor` |
| C (18, 19). Pure aggregation in `src/domain/code-profile.ts`: stored sources in, `CodeProfile` out | Same pattern as `confidence` and `cv-check`; testable without I/O; each number carries the `sourceId` it came from |
| D (21, 22). One paid Apify GitHub profile actor for the contribution calendar | REST has no contribution calendar; makes the run carry Apify data (hackathon criterion) and gives a 12-month activity curve |
| E (1, 3, 6, 8, 12). "Code contributions" section in the brief (synthesize seam) plus a run-page card with numbers, source links and caveats | Value lands where the recruiter reads; caveats are part of the card, not a footnote |
| F (10, 18). Numbers are FACTs only when a quote in an excerpt carries them; the totals are labeled COMPUTED from listed sources | Keeps "FACT needs a quote" intact; the aggregate is derivation, shown with its inputs |

## Critical assumptions

Categories: Desirability (value), Viability (cost, legal, business), Feasibility (build, API), Honesty (hard rules, claim integrity).

| # | Assumption | Category | Impact | Uncertainty | Priority |
|---|---|---|---|---|---|
| 1 | Recruiters and hiring managers act on contribution numbers (change a shortlist or an interview question), not just find them interesting | Desirability | H | H | Leap of faith |
| 2 | Non-technical recruiters read "PRs merged into other people's repos" correctly and do not read lines added as a quality score | Desirability | H | H | Leap of faith |
| 3 | Czech developer candidates have enough public activity for the card to say something (not "0 PRs, 3 repos") | Desirability | H | H | Leap of faith; many Czech devs work in private corporate repos |
| 4 | The confirmed GitHub account is the right person (namesakes, shared handles) | Honesty | H | M | Identity comes from the pasted profile or merge; test on 3 handles |
| 5 | `stats/contributors` returns usable data within the Workflow step: 202 while computing, fresh retry succeeds within 1 or 2 tries | Feasibility | H | H | Leap of faith; needs a bounded retry that never blocks the run |
| 6 | The author-keyed query `search/issues author:<h> type:pr is:merged -user:<h>` covers PRs merged elsewhere, with a count and the top repos from the first page (30 to 100 items) | Feasibility | H | M | Search API has its own 30 req/min limit |
| 7 | Request budget fits: about 12 requests per handle (profile 1, repos 1, stats for top ~5 own repos 5, PR search 1, events 1, orgs 1, languages from repo list 0, spare 2) | Feasibility | M | M | With `GITHUB_TOKEN` 5000/h, without 60/h shared by Worker egress IPs (known 403 in CLAUDE.md) |
| 8 | A paid Apify GitHub profile actor returns a contribution calendar at a cost that fits the $0.50 / 16-call run budget next to the existing ~15 optional actor steps | Viability | M | H | Pick actor and price from `research-apify-github`; must fit under `maxTotalChargeUsd` |
| 9 | The step stays inside the Workflow constraints: one `step.do`, only `{sourceId, excerpt}` returned (1 MiB cap), raw stats in R2 | Feasibility | M | L | Contributor stats for 5 repos are small |
| 10 | Aggregated numbers can be traced: each total equals the sum of excerpts in stored sources, and a reviewer can recompute it | Honesty | H | M | Excerpt cap is 2000 chars, so per-repo lines must be compact (`repo · +A −D · N commits · weeks W`) |
| 11 | Forks, bot commits, vendored or generated code, and squash-merges do not inflate totals beyond the stated caveat | Honesty | H | H | Exclude forks (already marked by `FORK_MARK`), exclude repos where the person is not the top-N author, show per-repo, not only a total |
| 12 | Public code activity analysis stays under "public data only" and does not become a personality or trustworthiness score | Honesty | H | L | No composite score, no rank, no "10x"; activity span and counts only. Commit timestamps stay in aggregate (no time-of-day habits, which could hint at religion or health) |
| 13 | The devil's advocate and verify seams do not downgrade or wrongly keep claims built from computed numbers | Feasibility | M | M | Verify checks quote-in-excerpt; a computed total has no single quote, so it needs its own claim kind or label |
| 14 | Role family detection is reliable: `familyOf(role)` or template family routes engineering and data correctly, and AI roles are covered | Feasibility | M | M | `Family` has no `ai` value, so AI roles must land in `data` or `engineering` |
| 15 | The extra evidence improves judged value and originality without raising run time past the demo window | Viability | M | M | Run already has a slow SERP step; the new step is REST-only plus one actor |

Leap-of-faith set: 1, 2, 3, 5, 11. Honesty gates 10 and 12 are cheap to test and fatal if wrong, so they run first anyway.

## Validation experiments

| # | Tests | Method | Success criteria | Effort | Timeline |
|---|---|---|---|---|---|
| E1 | 3, 4, 5, 6, 7 | Cheap spike on 3 demo developer handles (one prolific OSS, one typical Czech employee dev, one data/ML person): `curl` the 6 REST endpoints with and without `GITHUB_TOKEN`, record status, latency, request count, 202 behavior | per handle: ≤ 12 requests; stats endpoint gives data within 2 tries for ≥ 80 % of top-5 repos; PR search returns a count; ≥ 2 of 3 handles show something non-trivial (≥ 1 merged PR elsewhere or ≥ 500 lines in own non-fork repos) | 1 h | build day, first |
| E2 | 8 | Run the chosen Apify GitHub profile actor on the same 3 handles with `maxTotalChargeUsd` set; log in `docs/ops/llm-manual-runs.md` style | cost per handle ≤ $0.05; calendar present for 3 of 3; run total stays under $0.50 | 30 min | build day |
| E3 | 10, 11, 13 | Pure `code-profile.ts` unit tests with fixtures from E1: recompute totals by hand for one handle; add a fork, a bot-authored repo, a 202 repo, an empty account | hand total equals function total; fork and bot lines excluded; 202 repo listed as "stats not ready", not as zero; empty account returns a gap, not zeros | 1 h | build day |
| E4 | 12 | Read-through of the card and section text against the hard rules (checklist: no score, no rank, no time-of-day, no Art. 9 inference, caveats present) | 0 violations by a second reviewer | 15 min | before merge |
| E5 | 1, 2 | Comparison test with 4 people (2 recruiters or non-engineers, 2 engineers): same 3 candidates, brief with and without the card; ask for a shortlist order and one interview question per candidate | ≥ 3 of 4 pick up at least one specific repo or PR from the card; no one cites lines added as "better"; engineers rate the card useful (≥ 4 of 5) | 1 h | after build |
| E6 | 3 | Count, over the 10 most recent technical-role runs in D1 (or 10 Czech developer profiles from the demo list), how many have ≥ 1 confirmed GitHub account and non-trivial activity per E1 thresholds | ≥ 6 of 10 produce a non-empty card; if < 4, ship as "extra evidence when present", not as a headline | 30 min | build day |
| E7 | 15, 9 | End-to-end run on the 3 handles from a staging position with role "Backend Engineer"; compare run time and cost with the same run on "Account Manager" (step must skip) | added time ≤ 20 s; added paid cost ≤ $0.05; non-tech run unchanged and carries the gap "not searched: role is not technical" | 30 min | after build |

## Ledger measurements

Everything below is readable from the existing append-only `ledger_entries` and `gaps`; no new table.

| Measure | Where | Why |
|---|---|---|
| Requests per handle, by endpoint, status (200, 202, 403, 422, 429) | step ledger `ref` of `github_deep` | Proves the ~12 cap and shows 202 and rate-limit frequency |
| 202 retries and "stats not ready" count | step note | Assumption 5 |
| Paid actor cost and calls | `cost_usd`, `calls` on the step row | Assumption 8, budget share of the $0.50 |
| Step duration | ledger timestamps | Assumption 15 |
| Skip vs run ratio, with `roleFamily` | gap text "not searched: role is not technical" | Confirms routing (14) |
| Accounts scraped per run (merged candidates with platform github) | candidates + sources | Assumption 4 |
| Empty-card rate | `empty` flag on the step, onEmpty gap | Assumption 3 |
| Claims in "Code contributions" by kind and verify outcome (kept, downgraded, challenged) | `claims`, verify ledger row `ref.challenge` | Assumption 13 |
| Card opens and source-link clicks on `/runs/[id]` | log line only (no persistence), as in doc 14 E4 | Assumption 1 |

## Decision framework

- E1 passes and E6 ≥ 6 of 10 → build A to F as planned.
- E1 passes but E6 < 4 of 10 → keep the step, drop the headline placement: section appears only when non-empty, wording "public code evidence found", never a negative section for absent activity.
- E1 fails on stats (202 never resolves) → drop contributor stats and use commits from `events/public` plus the Apify calendar; keep PR search. Lines added and removed become "not available", stated as a gap.
- E1 fails on rate limit without a token → require `GITHUB_TOKEN` for this step; unset means skipped with the honest note, not a half result.
- E2 over $0.05 per handle → make the actor optional per run (only when budget remains after the other actors) or replace by REST events only.
- E3 shows totals cannot be traced to excerpts → store a compact per-repo line per source and make the total a displayed sum of listed lines, never a separate figure.
- E5 shows lines added read as quality → remove lines from the headline, lead with PRs merged elsewhere and languages, keep lines in an expandable detail with the caveat.
- E4 finds any score or rank language → block merge; fix the copy first.

## Discovery timeline

Build day (2026-10-09): E1, E2, E6 first (they decide the shape); E3 during implementation of `code-profile.ts`; E7 after `pnpm check`; E4 before the PR.

Day after: E5 with four people; tune card order and copy; decide on lines-added prominence.

## Open points for the build

- `FAMILIES` in `src/domain/position.ts` has no `ai` value (engineering, data, product, ...). AI roles must map to `data` or `engineering`; confirm in the role catalog before the gate ships (assumption 14).
- Decide the claim kind for computed totals before the synthesize change (assumption 13): FACT per listed repo line with a quote, aggregate marked COMPUTED with its inputs.
- Add `roleFamily` to `StepContext` in `src/recipe/sources/types.ts` and fill it where the context is built; `github_deep` is also listed as an evidence step for engineering and data templates in `src/domain/role-catalog/types.ts` (`HIRING_EVIDENCE_STEPS`), which needs a migration for `role_templates` seed.
- Update `CHANGELOG.md` under Unreleased in the same commit as the feature.
