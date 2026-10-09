# 15 — Pre-Mortem: LinkedIn profile suggestions on the start form

**Date**: 2026-10-09

**Status**: Draft

**Scenario**: Demo morning. The picker is on the start card. It either showed the wrong people, stalled, cost real money, or made the brief look less honest. Why?

---

## Risk summary
- **Tigers**: 5 (2 launch-blocking, 2 fast-follow, 1 track)
- **Paper Tigers**: 3
- **Elephants**: 2

## Launch-blocking Tigers

| # | Risk | Likelihood | Impact | Mitigation | Owner | Deadline |
|---|---|---|---|---|---|---|
| T1 | **Brave returns nobody for Czech names.** The index is thinner than Google's; "Jan Novák Seznam" returns blog posts and a Polish namesake. The picker looks broken on the first demo. | M | H | E1 on three demo subjects before UI polish; query carries the hint; empty state offers "paste the URL"; fetcher swap to the Apify SERP actor is one function if coverage fails. | Build agent | build day |
| T2 | **Key missing or credit exhausted on demo day.** 503 from the route. | M | M | 503 path renders the plain URL field with one calm line; cap 60/h per account; secret set with `wrangler secret put BRAVE_SEARCH_KEY` and checked in the deploy log. | Robert | before demo |

## Fast-follow Tigers

| # | Risk | Likelihood | Impact | Planned response | Owner |
|---|---|---|---|---|---|
| T3 | **Title parsing drift**: en dashes, localized suffixes ("\| LinkedIn" missing on `cz.linkedin.com`), truncated headlines show as names. | M | M | Parser falls back to the handle as the name; tests on real titles from E1; a hit is never dropped for a bad title. | Build agent |
| T4 | **Recruiters read the list as identity confirmation.** Someone picks the wrong Jan and the brief is about a stranger. | M | H | Row copy "via web search · pick the one you mean"; the run still resolves identity and marks `possibly-same-as`; the chosen card shows the handle for a second look. | Build agent |

## Track Tigers
- T5 **Cost creep**: a scripted client hammering the route. Trigger: `auth_attempts` kind `suggest` over 500/day. Response: lower the cap or require a position context.

## Paper Tigers
- **"This is LinkedIn scraping."** It is a web-search call for public pages; the picker never touches linkedin.com. It would become a tiger only if the fetcher were swapped to a LinkedIn people-search actor (option C, rejected).
- **"Typeahead will spam the API."** Explicit trigger (button or Enter), 3-char minimum, one in-flight request; no per-keystroke calls.
- **"A migration on demo day."** `0014` only rebuilds `auth_attempts` with a wider CHECK; data is copied, the index recreated; local migrate in `pnpm check` flow and remote by Robert before merge, same as 0010.

## Elephants
- **The Apify judging line.** The first screen will show a non-Apify vendor. Conversation starter: the research run is all Apify; the form field is UX. If judges weigh it, option B is a one-function swap and can be demoed as the fallback.
- **Namesakes are the product, and the picker makes the recruiter decide early.** If the picker is good, people stop reading the identity section. Conversation starter: keep the identity map card and the `possibly-same-as` language regardless of how the URL arrived.

## Go/No-Go checklist
- [ ] E1 passed on 2 of 3 demo subjects
- [ ] `BRAVE_SEARCH_KEY` set in prod, 503 path verified once with the key removed locally
- [ ] Migration 0014 applied remote
- [ ] `pnpm check` green, dry-run bundle green
- [ ] Rollback: unset the secret → field behaves as before, no deploy needed
