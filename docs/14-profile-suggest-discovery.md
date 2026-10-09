# 14 — Discovery: LinkedIn profile suggestions on the start form

**Date**: 2026-10-09

**Product Stage**: existing product (web app, signed-in recruiters, profile-first start form)

**Discovery Question**: Will a name-to-profile picker on the start card remove the "find the URL on LinkedIn" detour without weakening the honesty of the brief, and can it be built on a sub-second public source within the hard rules?

---

## Ideas carried forward

From `docs/13-profile-suggest-brainstorm.md`:

| Idea | Rationale |
|---|---|
| A. One suggest route over a web-search `site:linkedin.com/in` query | No linkedin.com traffic, parser half exists |
| B. One field that takes a name or a URL | No new mode for URL pasters |
| C. Explicit search with an editable chosen state | Bounded cost and latency, recruiter keeps control |
| D. ARES-style guard rails and a pure tested parser | Proven shape from plan 009 |
| E. Fallbacks and calm copy | Outages never block a brief |

---

## Critical assumptions

| # | Assumption | Category | Impact | Uncertainty | Priority |
|---|---|---|---|---|---|
| 1 | Recruiters start from a name more often than from an open LinkedIn tab | Value | H | M | Leap of faith; the extension covers the tab case, the picker the name case |
| 2 | A web-search snippet list is trusted enough to pick from (name + headline) | Value | H | M | Test with the 3 demo subjects |
| 3 | Brave's index covers Czech public profiles well enough that the right person is in the top 8 | Feasibility | H | H | Leap of faith; verify from the Worker before UI polish |
| 4 | Title format `Name - Headline - Company \| LinkedIn` is stable enough to parse | Feasibility | M | M | Parser keeps unparsed hits, tests on real titles |
| 5 | Brave answers in under 1 s from Workers | Usability | M | M | Measure once; if > 3 s, keep the button but add "still looking" copy |
| 6 | Per-account cap of 60/h and the free credit cover a demo month | Viability | M | L | Cap is enforced in D1 like ARES |
| 7 | SERP snippets of public profiles stay inside "public data only" | Viability | H | L | Snippets are search-engine data; the picker never reads linkedin.com |
| 8 | Recruiters understand "pick the one you mean" does not confirm identity | Usability | M | M | Copy says "via web search"; the brief still resolves namesakes |

Leap-of-faith: 1 and 3.

---

## Validation experiments

| # | Tests | Method | Success criteria | Effort | Timeline |
|---|---|---|---|---|---|
| E1 | 3, 5 | `curl` the Brave endpoint for the 3 demo subjects (name + company) from the deployed Worker | right profile in top 8 for ≥ 2 of 3; p50 < 1.5 s | 20 min | build day |
| E2 | 4 | Unit tests on 10 real SERP titles collected in E1 | all parse to name + headline or fall back to handle | 20 min | build day |
| E3 | 2, 8 | Hallway test: two people start a brief from a name only | both pick without opening LinkedIn; no one calls the list "confirmed" | 15 min | after build |
| E4 | 1 | Count `via=start` runs whose `profileUrl` came from the picker (hidden field `profileSource=suggest`, no persistence needed; log line) | ≥ 50 % of new briefs on demo day | demo day |

---

## Decision framework
- E1 passes → ship A as designed.
- E1 fails on coverage but latency is fine → add the hint prominently, try `country=` unset; if still poor, swap the fetcher to the Apify SERP actor (option B) behind the same handler.
- E3 shows people read the list as identity → stronger copy and a "not sure, search again with company" link.

## Discovery timeline
Build day (2026-10-09): E1, E2 during implementation; E3 after `pnpm check`; E4 on demo day.
