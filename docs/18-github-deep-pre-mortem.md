# 18 — Pre-Mortem: GitHub deep scrape for technical roles

**Date**: 2026-10-09

**Status**: Draft

**Scenario**: Demo morning, three real candidates. The "Code contributions" card either shows nothing, shows wrong or unsourced numbers, shows a namesake's work, burns the anonymous GitHub quota, or reads as a productivity score. Why?

Code locations below were read on 2026-10-09: `src/recipe/sources/types.ts`, `src/recipe/runner.ts`, `src/recipe/batch.ts`, `src/adapters/fetch.ts`, `src/adapters/d1.ts`, `src/workflow/research-run.ts`, `src/recipe/seams/sections.ts`, `src/domain/challenge.ts`.

---

## Risk summary
- **Tigers**: 10 (6 launch-blocking, 3 fast-follow, 1 track)
- **Paper Tigers**: 4
- **Elephants**: 3

## What the code already says (facts the risks rest on)
- `Collector.requests(ctx)` is one-shot and pure. It returns all requests up front. It cannot say "fetch the repo list, then stats for the top 8".
- `makeFetchJson` retries only 429 and 503, once. HTTP 202 is `res.ok`, so a computing stats response returns an empty body as if it were data. Any other non-2xx throws.
- `isPaid` treats every `rest/*` actor as free. `planBatch` uses it to cap paid steps per batch.
- `canonicalUrl` dedupe: "one source per page". `rest/github` already stores each repo `html_url`.
- `identityFor` gives "merged" only when the first path segment equals the merged handle or the URL sits under a merged profile URL.
- `doStep` retries a failed step once after 5 s. A retry re-runs every request of the step.
- `EXCERPT_MAX` is 2000 and `quoteInExcerpt` needs the quote inside the excerpt.

---

## Launch-blocking Tigers

| # | Risk | L | I | Mitigation (code location) | Deadline |
|---|---|---|---|---|---|
| T1 | **Dependent requests do not fit the Collector contract.** Per-repo stats need the repo list first. A plain `requests()` cannot know the top 8 repos, so the builder bolts a fetch loop into the collector and breaks "collectors are pure". Or it guesses repo names and gets 404s. | H | H | Split into two collectors/steps: `github_profile` already stores the repo list in `ctx.sources` (raw repos). `rest/github-deep.requests(ctx)` reads those stored repo sources (non-fork, sort by `pushed_at`, top 8) and emits the stats URLs. If no repo sources exist yet it returns `[]` with note "no repos stored". Order guarantee: `github_deep` must not share a batch with `github_profile`. Today everything after the lineup runs in `PARALLEL` batches, so add `github_deep` as a non-batched step after `flush()` or give `planBatch` a `after` constraint. Place: `hiring.ts`, `batch.ts`, `research-run.ts:flush`. | before build |
| T2 | **202 from `stats/contributors` is read as data.** `fetchJson` returns `{}` or `""`, the parser yields zero sources, the card says "no code contributions" for an active engineer. Worse: the step looks successful and `onEmpty` text claims "not found". | H | H | In `parse` treat non-array payload as "computing": emit no source and a note `stats computing, not available`. Retry inside the port, not the collector: add an optional `retryOn202` (3 tries, 2 s apart, total under the 45 s step budget) in `makeFetchJson` for `api.github.com/repos/*/stats/*` only. Final failure becomes a gap "contributor stats not ready", never an empty-result gap. Also drop stats if the repo has more than 10k commits (GitHub returns 202 forever for huge repos). Place: `src/adapters/fetch.ts`, `github-deep.ts` parse, `__tests__/sources-makers.test.ts`. | before build |
| T3 | **Anonymous quota exhausted by the demo itself.** 60/h shared by all Workers egress IPs, so other tenants may already have used it. Three candidates x up to 12 requests plus `github_profile`'s 2 each is 42 calls, with `search/issues` on a separate 10/min bucket. One earlier rehearsal run and the demo returns 403 on candidate 2. `doStep` retry then doubles the requests. | H | H | (a) Set `GITHUB_TOKEN` in prod before the demo (5000/h); CLAUDE.md already lists it as optional, make it a go/no-go item. (b) Budget requests per handle in the collector (hard cap 12) and read `x-ratelimit-remaining`; when under 15 skip PR search first, then events, and write "not searched: GitHub rate limit" via `skipped` note with `calls === 0`. (c) Step `retries` is 1: a partial failure must not re-issue successful requests, so store sources per request and treat `request failed` as partial. (d) Rehearse the 3 demo candidates once, then reuse CACHED runs for the demo path. Place: `fetch.ts`, `github-deep.ts`, `research-run.ts:doStep`. | day before |
| T4 | **PR evidence gets identity "unverified" and disappears.** A merged PR into another person's repo lives at `github.com/<other-org>/<repo>/pull/N`. `identityFor` looks at the first segment, which is the other org, so the source is "unverified". Sections need a merged supporting source for a FACT, `noneConfirmed` may add the namesake gap, and the card's best number (PRs merged upstream) is unsupported. The same applies to a contributor-stats source for a repo owned by an org the candidate belongs to. | H | H | Set `identity: "merged"` explicitly in `ParsedSource` for sources fetched via the merged handle's API (author search `author:<handle>` results). Do not rely on `identityFor`. Then make sure `applySourceIdentity` (`d1.ts:195`, runs before extract) does not downgrade it: add a test with a PR URL under a foreign org and a merged handle. Also use the API URL of the search result as `raw` and the PR `html_url` as source URL. Place: `github-deep.ts`, `sourceIdentityUpdates`, `sources-identity.test.ts`. | before build |
| T5 | **Source dedupe eats the deep sources.** Repo stats use the repo `html_url`, which `github_profile` already stored. The runner keeps one source per canonical URL, so the stats excerpt is dropped and "lines added" has no source. The same happens for profile (`/users/<h>`) vs `html_url`. | H | H | Give deep sources distinct URLs that are real, openable pages: `https://github.com/<o>/<r>/graphs/contributors` for stats, `https://github.com/<o>/<r>/pulls?q=is:pr+author:<h>+is:merged` for PRs, `https://github.com/<h>?tab=repositories` for the account overview. Add a runner test: deep source with a repo-adjacent URL is stored even when the repo URL exists. Place: `github-deep.ts`, `runner.test.ts`. | before build |
| T6 | **A number on the card has no quote inside an excerpt (excerpt cap 2000).** Eight repos of weekly commits (52 weeks) cannot fit in one 2000-char excerpt, so the builder aggregates in code and cites a source that does not contain the figure. This breaks the one hard rule: FACT needs a quote inside a supporting excerpt. | H | H | One source per repo (stats), per fact family (PRs, languages, events). Each excerpt is a compact deterministic line: `owner/repo · commits 142 · +12,340 / -4,102 · active weeks 31/52 · period 2025-10..2026-10`. `code-profile.ts` computes totals only from numbers parsed back out of those stored excerpts, and every `CodeProfile` field carries `sourceId` + `quote` (the exact substring). Add a pure test: for every field, `quoteInExcerpt(field.quote, source.excerpt)` is true; totals are labelled "sum of N repos shown", never "lifetime". Drop weekly arrays from excerpts; keep them in `raw` (R2) only. Place: `src/domain/code-profile.ts`, `src/domain/__tests__/code-profile.test.ts`. | before build |

## Fast-follow Tigers

| # | Risk | L | I | Planned response | Owner |
|---|---|---|---|---|---|
| T7 | **Apify GitHub actor is unproven and mis-budgeted.** `rest/github-deep` starts with `rest/`, so `isPaid` calls it free. If one collector issues both REST and the actor call, `planBatch` never counts that paid run against the 16, and `maxTotalChargeUsd` may be missing. The actor may need a per-site cookie or return nothing for the calendar. | M | H | Make the contribution calendar its own step with a non-`rest/` actor id so `isPaid` is true, `maxTotalChargeUsd` is set (cap 0.05), and it consumes one of the 16 runs. Run E1 on the 3 demo handles before wiring UI; if the calendar is missing, drop it (calendar is nice-to-have, not core) and say so as a gap. Place: `hiring.ts`, `batch.ts`, `github-deep.ts`. | Build agent |
| T8 | **Role family wrong for the demo roles.** `familyOf(role)` is a regex on the title; a template may be absent for "Founding engineer", "ML platform lead" or Czech titles, so the step is skipped silently for a technical candidate, or run for a designer. | M | M | `StepContext.roleFamily` = template `family` (join already in `loadContext`, `d1.ts:109`) else `familyOf(role)`. Add AI to the allowed set, or the lead's "engineering or data" excludes AI roles that the brief names. Record the decision in the ledger (`family`, `source: template|regex`). Add a test over the demo role titles in EN and CZ. Place: `d1.ts:loadContext`, `types.ts`, `position-extract.ts:familyOf`. | Build agent |
| T9 | **Wrong or extra handle.** Merged identity may hold two GitHub profiles (a work account and a personal one), or the merge was a `possibly-same-as` that got confirmed by the manager on thin evidence. Deep scrape multiplies the damage: 12 requests and a stats table for a stranger. | M | H | Scrape only `decision === "merge"` candidates (`acceptedCandidates`), cap 2 handles, and print the handle with link and the identity reason on the card header. If the merge came from a manager click rather than a profile-link match, show "identity confirmed by recruiter". Never auto-add handles found in READMEs. Place: `github-deep.ts` requests, run page card. | Build agent |

## Track Tigers
- T10 **Quota or cost drift after the demo.** Trigger: more than 5% of runs with a GitHub 403/429 note, or any run where paid actor runs plus LLM spend exceeds 0.45 USD. Response: raise the token tier, shrink repo cap from 8 to 5, or disable the calendar actor via a recipe flag.

## Other scenarios (rated, mitigations in code)

| Area | Scenario | L x I | Mitigation and location |
|---|---|---|---|
| Data | Vendored, generated or lockfile commits (e.g. 400k lines of `node_modules`, protobuf output) make "lines added" meaningless; a bot account or a mono-repo bulk rename makes a junior look senior. | H x H | Show lines only next to commits and active weeks, never alone; cap per-repo display and flag outliers (lines per commit over 2,000) as "likely vendored or generated, not counted". Card caveat is required text, not a tooltip. `code-profile.ts`. |
| Data | Squash merges and web-UI commits are attributed to the wrong person; commits under an unlinked email do not count. Contributors endpoint only covers the default branch. | M x M | Caveat copy; do not compute "share of repo". |
| Data | Low-activity candidates (senior managers, researchers) show a near-empty card that looks like a negative. | H x M | Card shows "public code is only part of the picture; private work is invisible"; a sparse profile produces a gap, never a lower score. No ranking, no grade. |
| Time | Total run time grows: 8 stats calls at 2 s plus retries, plus events, plus search/issues pacing at 10/min (6 s apart). Brief promise is 2-4 minutes. | M x M | Run requests inside the step with a 20 s ceiling; skip PR search pages beyond page 1 (30 results); `github_deep` is the last collector before `extract_claims`; progress shows "reading GitHub in depth". |
| Time | Demo is tomorrow: scope creep into stars, orgs, languages, timeline. | H x M | Cut order if late: calendar actor, events timeline, stars, orgs. Keep: profile, repos, stats, merged PRs, languages. |
| Budget | Free REST steps are not gated by `maxTotalChargeUsd`; only `calls` and USD of actors and LLM count. A big `code-profile` goes into the synthesize prompt and extract, raising LLM spend. | M x M | Feed the LLM the 3-6 deterministic summary lines, not raw stats. Add a test that prompt size for a 8-repo profile stays under a fixed char cap. `synthesize.ts`, `extract.ts`. |
| Honesty | Card shows a coverage claim the data cannot back ("8 repos analysed") when stats were 202 for 3 of them. | M x H | Card prints "stats available for K of N repos" taken from the stored sources. Derived from the same sources as the numbers, not from a counter. |
| Honesty | Devil's advocate downgrades or mis-fires: `forkPrecheck` only reads the "forked repository" marker. A PR into someone else's repo is not own work, and the "someone-else" ground could challenge a PR FACT. | M x M | Mark PR excerpts "pull request merged into <owner>/<repo>" and keep the must-have FACT for contributions to others separate from "own repo" claims. Test with `challenge.test.ts`. |
| Identity | Namesake handle: `github_profile` falls back to name search (`search/users?q=<name>`); the deep step must never run on search hits. | M x H | `requests()` returns `[]` unless an accepted candidate has a handle; unit test with only a search-hit source in ctx. Reuse `acceptedCandidates`. |
| UI | Card renders numbers without source links on mobile, or the run page breaks for runs without a code profile (older runs, non-technical roles). | M x M | Card is optional; hidden entirely when `roleFamily` is not technical. Every number is a link to its source. CACHED label stays on replay. Run page component + `readChallenge`-style defensive reader. |
| Legal | GDPR: assembling a work-pattern profile of a named person from commit timing and orgs. Events timeline reveals hours, rest days and religious observance patterns; org memberships and starred repos can imply politics or religion (Art. 9). | M x H | No stars of non-technical or political/religious topics, no org list beyond employer-relevant names, no time-of-day or weekday patterns, only counts per month. Run the existing `containsArt9Topic` over every excerpt before storing. Never store commit author emails from events payloads (strip in `parse`, keep nothing in `raw`). Raw is purged after judging (hard rule). |
| Legal | GitHub terms: REST is allowed with the public API; the Apify actor scrapes HTML. | L x M | Calendar actor optional and labelled; REST is the primary path. |
| Legal | The output reads as a score ("top contributor", "productivity"). The brief forbids personality, credit or trustworthiness scores. | M x H | Fixed neutral wording: counts and dates only; no percentile, no adjectives, no sort of candidates by code metrics. `code-profile.ts` returns numbers, not labels; lint test grep for banned words. |

## Paper Tigers
- **"The 202 loop will hang the Workflow."** A bounded retry (3 x 2 s) inside a step that already has a 45 s ceiling is safe. It only turns into a Tiger if retries move into the Workflow `step.sleep` path.
- **"Another 12 requests per handle will cost money."** REST is free. Only the optional Apify calendar run spends, capped at 0.05 USD and counted against 16 runs.
- **"Needs a migration."** None: sources, claims and gaps are reused, the profile is a pure function of stored sources, and `roleFamily` is a context field, not a column (the join already exists).
- **"Forks pollute the stats."** `fork` is in the repo payload and `FORK_MARK` already exists. Filtering non-forks before building stats URLs is a one-line filter with a test.

## Elephants
- **Code volume as a hiring signal is contested.** Recruiters will compare "lines" across candidates anyway. Conversation starter: show activity and merged upstream PRs as the headline, lines as small print, and say on the card what each number cannot show.
- **The 3 demo candidates may have thin public GitHub.** The feature wins on a strong profile and looks empty on the others. Conversation starter: choose at least two demo candidates with real public code today, and plan the empty-state story ("what we could not see, and why") as part of the pitch; it supports the honesty score.
- **Apify fit.** Most of this feature is plain GitHub REST. Judges weigh Apify use. Conversation starter: keep the calendar actor as the visible Apify piece, but do not let it block the demo if it fails.

## Go / No-Go: must-fix before demo
- [ ] T1: deep step reads stored repo sources and is ordered after `github_profile` (no same-batch race)
- [ ] T2: 202 handled in the port and parser, with a gap, never an "empty" claim
- [ ] T3: `GITHUB_TOKEN` set in prod and rate-limit headroom check; 3 demo candidates run once end to end beforehand
- [ ] T4: PR and org-repo sources carry `identity: "merged"` and survive `applySourceIdentity` (test with a foreign-org URL)
- [ ] T5: deep sources have URLs distinct from `github_profile`'s repo URLs (runner test)
- [ ] T6: every card number has a source id and quote inside a stored excerpt (pure test over `code-profile.ts`)
- [ ] Art. 9 and score checks: no stars, no time-of-day patterns, no emails stored, no rankings or adjectives
- [ ] Required caveats on the card: private work invisible, forks excluded, lines are a weak proxy, vendored code inflates lines, namesake handle risk
- [ ] Calendar actor budgeted as a paid run (own non-`rest/` step) or cut
- [ ] `pnpm check` green, `pnpm exec wrangler deploy --dry-run` bundles, CHANGELOG line added
- [ ] Rollback: remove `github_deep` from the hiring recipe (one line); no migration to undo
- [ ] Cut line if time runs out: calendar actor, events, stars, orgs go first; profile, repos, stats, merged PRs, languages stay
