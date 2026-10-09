# 16 — Brainstorm: GitHub deep scrape for technical roles

**Mode**: Ideas for existing product (oldboys hiring recipe, Candidate Brief)

**Context**: Today `github_profile` (`rest/github`) fetches one user and ten recent repos, unauthenticated, and the brief has a thin "Public code" section. When the position's family (`familyOf`, role catalog) is engineering, data or AI, the recipe should scrape every merged GitHub account in depth: profile, own non-fork repos, per-repo contributor stats, merged PRs into other people's repos, languages, orgs, activity timeline, stars. REST with `GITHUB_TOKEN` plus one paid Apify GitHub actor, so the run carries Apify data. Output is a "Code contributions" section: every number a FACT with a quote inside a source excerpt, split from INFERENCE, gaps stated, namesakes handled. Non-technical roles skip with "not searched: role is not technical". Public data only, no personality or trustworthiness score.

---

## PM Perspective (user value, business impact)

1. **"Code contributions" section with numbers, not adjectives** — per account: public non-fork repos, commits by the candidate, lines added and removed, merged external PRs, active weeks, top languages. Each number is a FACT with a quote from the source excerpt and a link. A hiring manager reads facts in 30 seconds instead of browsing a profile. | Impact: H | Effort: M
2. **Ownership vs drive-by split** — separate repos the candidate owns or leads (top contributor share, repo created by them) from repos where they landed a few commits. Shown as counts and shares, stated as numbers; the reading ("looks like maintainer") is a labeled INFERENCE. | Impact: H | Effort: M
3. **Merged PRs into other people's repos** — the strongest public collaboration evidence: list of merged PRs to repos not owned by the candidate, with repo stars, title, merge date, additions and deletions. Opened-but-unmerged PRs are counted apart, never mixed in. | Impact: H | Effort: M
4. **Recency and depth vs breadth, as plain numbers** — commits per month over 12 months, share of work in the top language, count of repos with more than N commits by the candidate. No "is active" verdict; the manager decides against the role (a 2-year gap may be a job under NDA). | Impact: M | Effort: L
5. **Skip is visible** — non-technical roles print "not searched: role is not technical". Technical roles with no GitHub account print the existing gap. The step never runs on a guess, which saves budget and keeps the goal delta honest (E3). | Impact: M | Effort: L
6. **Honest framing in the brief itself** — a fixed note under the section: "Lines of code are a weak proxy for value. Private and employer-internal work is invisible. Forks are excluded." Matches the honesty criterion and pre-empts the obvious recruiter misreading. | Impact: H | Effort: L
7. **Must-have linkage** — a role must-have like "Rust" or "Kubernetes" gets matched deterministically against repo languages and topics; the section says "Rust: 4 own repos, 1 280 lines added in 2025" or "no public Rust code found" (a gap, not a rejection). | Impact: H | Effort: M

## Designer Perspective (UX, legibility, delight)

8. **Stat strip first, detail on demand** — a row of 5 tiles (repos, commits 12 mo, merged external PRs, languages, last activity) each carrying its source link; below, a collapsible per-repo table. Tiles show the number only, no color verdicts. | Impact: H | Effort: M
9. **Activity timeline as a 52-week sparkline** — commits per week from the contributor stats, one thin chart per account, gaps in the data drawn as hatched bars with "stats not ready" rather than zeros. Zero and unknown must look different. | Impact: M | Effort: M
10. **Fact vs inference chips** — reuse the existing FACT / INFERENCE styling: numbers are FACT chips with a source popover (the quote), the "owner of this project" line is an INFERENCE chip with the numbers it rests on listed beneath. | Impact: H | Effort: L
11. **Per-repo row reads like a CV line** — repo name, one-line description, language, "candidate: 412 of 530 commits (78%)", stars, last push, flags "fork excluded" or "stats pending". Sort by candidate share by default; manager can switch to stars or recency. | Impact: M | Effort: M
12. **Gaps drawer for code** — one fixed list: private contributions invisible, forks excluded, contributor stats 202 not ready for N repos, accounts not merged (namesakes) listed as "not included". Same component as the existing gap list. | Impact: M | Effort: L
13. **Namesake banner** — if the lineup has two GitHub candidates, only the merged one is scraped; the other shows as "possibly the same person, not included: confirm in the lineup to add it". | Impact: M | Effort: L
14. **Tests and docs signals as small badges** — "has tests directory", "has CI workflow", "README present", "license present" per owned repo, each a FACT from the repo tree. Shown as ticks, no composite score. | Impact: M | Effort: M

## Engineer Perspective (technical leverage, reliability)

15. **Gate on family in the recipe, not in the collector** — a pure `isTechnicalFamily(family)` over `engineering | data | ai`; the position's family reaches `StepContext` like `roleSites`. Non-technical or no position: the step records the "not searched" line and spends nothing. | Impact: H | Effort: L
16. **REST collector set on `GITHUB_TOKEN`** — `GET /users/{u}`, `/users/{u}/repos?type=owner` (filter `fork:false`), `/users/{u}/orgs`, `/repos/{o}/{r}/stats/contributors`, search `GET /search/issues?q=author:{u}+type:pr+is:merged+-user:{u}` for external merged PRs, `/repos/{o}/{r}/languages`. 5 000 req/h authenticated; the Worker already passes the token through `makeFetchJson`. Cap at top 10 repos by recent push and top 20 PRs per run. | Impact: H | Effort: M
17. **Stats 202 handled as a gap, not a retry loop** — contributor stats return 202 while GitHub computes them. One retry after the other requests, then record "stats not ready for repo X" as a gap. The step stays one `step.do`; no sleeping in the runner. | Impact: H | Effort: M
18. **Numbers are rendered into excerpts, then quoted** — the collector writes lines like `owner/repo · candidate commits 412 of 530 · +18 204 / -9 311 lines · weeks active 37` into the Source excerpt; the extract seam quotes that line, so FACT verification (quote within excerpt) stays deterministic and needs no model. Raw JSON goes to R2 only. | Impact: H | Effort: M
19. **Contributor attribution by login, not by name** — stats rows are keyed by `author.login`, so only the merged account's login counts. Commits authored by email without a linked account are listed under a gap ("commits not linked to the account are invisible"). No fuzzy matching on names. | Impact: H | Effort: L
20. **Every merged account, one step each iteration** — loop over accepted `github` candidates from the lineup, bounded (max 3 accounts). Unmerged candidates are never fetched; `possibly-same-as` is shown, not scraped. | Impact: M | Effort: L
21. **One paid Apify GitHub actor for what REST makes expensive** — candidates: a GitHub profile/repo scraper actor for followers, pinned repos, contribution-year summary and topics, or a repo-tree/README crawler for tests, CI and docs signals. Called once with `maxTotalChargeUsd`, counted as one of the 16 paid runs, `apify-client` with the 45 s timeout. Exact actor is chosen by the research agents; the REST path must still work if the actor times out (gap, not failure). | Impact: H | Effort: M
22. **Cheap Apify uses, ranked** — (a) one actor run for pinned repos and contribution calendar totals of the profile page, cents; (b) one run of `website-content-crawler` over the top 3 owned repos' READMEs and `.github/workflows` listing for docs/CI signals, cents; (c) no per-repo actor loops. Budget gate stays in the runner. | Impact: M | Effort: M
23. **Devil's advocate hooks** — extend the fork precheck: a repo with `fork: true`, a template-generated repo, or one with a single initial commit never counts toward "own work"; vendored or generated lines are named as a limit of the proxy. Only downgrades, as today. | Impact: M | Effort: M
24. **Pure parsers with fixtures under test** — `src/recipe/sources/github-deep.ts` stays pure (requests + parse), fixtures from real responses (stats, search issues, 202 body). A new unit test next to the domain code covers the "not searched" line and the family gate. Header per `rules/file-headers.md`, step file stays under 150 lines. | Impact: H | Effort: L
25. **Bus-factor and collaboration as arithmetic** — top-contributor share per repo, distinct co-authors, merged PRs reviewed by others. Only the arithmetic is a FACT. "Single point of failure on this repo" is an INFERENCE about the repo, and says nothing about the person's character. | Impact: M | Effort: M

---

## Top 5 Recommendations

| Rank | Idea | Why | Quick Win? |
|---|---|---|---|
| 1 | 16 + 18 + 24: authenticated REST collector, numbers rendered into excerpts, pure parsers with fixtures | Gives FACT claims that pass the existing quote-in-excerpt verify with no model; the core of the section | No (core build) |
| 2 | 15 + 5: family gate with the "not searched: role is not technical" line | Protects budget and the goal delta, trivial to test | Yes |
| 3 | 3 + 2: merged external PRs and ownership vs drive-by | The two signals hiring managers trust most, both countable | No |
| 4 | 21 + 22: one bounded Apify GitHub actor with a REST fallback | Puts Apify data in the run for judging without making the section depend on it | No |
| 5 | 6 + 12 + 17: fixed honesty note, gaps drawer, stats 202 as a gap | Scores on the honesty criterion; costs almost nothing | Yes |

Deferred: 14 (tests/docs badges) until the Apify actor choice is known; 9 (sparkline) after the numbers section ships; 25 beyond plain arithmetic. Not proposed: any composite score, "seniority" grade or "10x" label (hard rule: no scores of personality or trustworthiness).

---

## Next Steps

Research agents settle two open points: which Apify GitHub actor to use (output shape, price per run) and the exact REST endpoints and rate limits, including the 202 behavior of contributor stats. Discovery (`docs/17-github-deep-discovery.md`) stress-tests: how many candidates have an accepted GitHub account, token rate limits from Workers egress, whether lines added/removed mean anything for the demo subjects, and whether recruiters read numbers as a verdict. Pre-mortem in `docs/18-github-deep-pre-mortem.md`; the recipe change goes into `src/recipe/goals/hiring.ts` after the plan is accepted.
