# 01 — Deep dive: codebase facts and option fact sheet

Part A is read from the code on 2026-10-09 (worktree `suggest`, base `origin/main` d4838dd). Part B is the external research (agents `research-suggest` and `case-studies`, URLs inline; the agents ran none of the services, every figure is from vendor pages or secondary sources). Anything not traceable is marked ASSUMPTION.

---

## A. Codebase facts

### The start form today
- `src/app/start-form.tsx` (200 lines, client): one `Field` for `profileUrl` (text input with `inputMode="url"`), a `<details>` with the CV textarea, the role field (hidden when `?positionId=` resolves), privacy card, submit to `POST /api/start`. The body is shaped by `buildStartBody` in `src/app/start-body.ts` (pure, tested).
- `POST /api/start` (`src/app/api/start/route.ts`): same-origin check, session cookie, then `createRun` from `src/app/api/runs/handler` with `via = "start"`. The server normalises the URL with `normalizeLinkedinProfile` (`src/domain/profile-url.ts`, pure, tested) and rejects anything that is not `linkedin.com/in/<handle>`.
- The seed seam (`src/recipe/seams/seed.ts`) scrapes the given profile once with `harvestapi/linkedin-profile-scraper` and makes it the merged identity. Nothing about this changes: the picker only has to produce a URL.
- The same form is rendered on `/` and `/onboarding`; `/positions/<id>` links to the form with `?positionId=` and already shows a "Search people on LinkedIn" external link (`src/app/positions/position-detail.tsx:52`), which is exactly the detour the picker removes.

### Reusable pieces
| Piece | Where | Reuse |
|---|---|---|
| Same-origin + session gate | `src/app/api/_lib/same-origin.ts`, `src/app/api/_lib/session.ts` | copy the ARES route shape |
| Per-IP hourly cap | `throttled` / `recordAttempt` in `src/app/api/_lib/auth-store.ts`, kinds in `src/domain/auth-limits.ts` (`AttemptKind` union) | add kind `suggest` |
| JSON fetch with timeout and per-host credentials | `src/adapters/fetch.ts` `makeFetchJson(creds)` | add a search API key the same way as `OPENALEX_API_KEY` |
| Apify actor call | `src/adapters/apify.ts` `makeActorCall(token)` | runs `POST /v2/acts/.../runs?waitForFinish=`, polls, reads dataset; min charge $0.50 cap |
| SERP parser | `src/recipe/sources/google-search.ts` (`organicResults[].title/url/description`) | the suggest parser reads the same shape |
| Noise filter for people-search pages | `src/recipe/seams/resolve.ts:206` `isNoise` | drop directory URLs from suggestions |
| Lookup handler test pattern | `src/app/api/ares/__tests__/lookup.test.ts` (fake D1 dispatching on SQL prefixes, fake fetch) | same for the suggest handler |
| Lookup UI pattern | `src/app/register/company-fields.tsx` (`Lookup` status union, `LOOKUP_MESSAGE`, `STATUS_KIND`) | same status-enum shape for the picker |

### Constraints that bind the design
- Rule: no interfaces with one implementation; ports are plain function parameters; no `runtime = "edge"`; every file carries the header; `pnpm check` is strict (typescript-eslint strictTypeChecked).
- Migrations `0012` and `0013` are already claimed by peers (candidate pool, role templates) in the shared checkout; plan `010` is the candidate pool. This plan is `011` and adds **no migration**.
- Budget rule: enforced in the runner, never by the LLM. A suggest query is outside any run, so its only brake is the per-IP cap (like ARES) and the provider's own quota.
- Hard rules: public data only, no LinkedIn login or cookies. A search-engine snippet of a public profile is public data; scraping `linkedin.com` directly for search results is not available without login.
- `Cache-Control: no-store` on every lookup response (ARES precedent).

### Observed latencies (from code comments and ledger notes, ASSUMPTION where marked)
- `apify/google-search-scraper`: `timeoutSecs: 90`, cost ≈ $0.002 per query (comment in `google-search.ts`); memory note "slow SERP step" in the deploy memory. ASSUMPTION: 5 to 20 s wall time per run including queueing.
- `harvestapi/linkedin-profile-scraper`: `timeoutSecs: 45`, `$4 per 1k` profiles.
- `makeFetchJson`: 20 s timeout, one retry on 429/503.

---

## B. Option fact sheet (external)

_Filled from the research agents below._

### B1. Brave Search API (web search, `site:` supported)
- Query docs: `q`, `count` (max 20), `country`, `search_lang`, `safesearch`; results in `web.results[]` with `title`, `url`, `description`; operators such as `site:github.com` go inside `q`; auth header `X-Subscription-Token`. Source: https://api-dashboard.search.brave.com/app/documentation/web-search/query
- Pricing 2026: the old Free (2 000/month), Base and Pro tiers were retired when the API relaunched; every account gets $5 free credit per month (≈1 000 queries), then $5 per 1 000 requests on the Search plan with a 50 req/s limit. Sources: https://costbench.com/software/ai-search-apis/brave-search-api/ , https://costbench.com/changelog/brave-search-api-price-decrease-2026-05/ (third-party trackers; the dashboard is the authority, ASSUMPTION until Robert's account shows the plan)
- Latency: p50 ≈ 430 ms in a July 2026 benchmark (https://parallel.ai/articles/best-web-search-api.md, secondary). Free credit tier is limited to 1 request/s and 429s are common (Open WebUI retries once after 1 s: https://docs.openwebui.com/features/chat-conversations/web-search/providers/brave); `makeFetchJson` already retries once on 429. Storing results needs a plan with storage rights (https://brave.com/search/api/), so the suggest route does not cache. `site:` documented at https://api-dashboard.search.brave.com/documentation/resources/search-operators.

### B1b. Serper.dev and SerpApi (Google SERP resellers)
- Serper: $0.30–1.00 per 1 000, 2 500 free, p50 ≈ 2.2 s (https://coldiq.com/blog/serper-pricing , https://sia.hackernoon.com/serp-benchmarks-success-rates-and-latency-at-scale, both secondary). SerpApi ≈ $0.025 per search (https://costbench.com/software/web-scraping/serpapi/). ToS on this use not read. Serper is the named second provider if Brave's coverage of Czech names is poor: same handler, URL builder and parser change.

### B2. Google Custom Search JSON API
- 100 queries/day free, $5 per 1 000 after, up to 10 k/day, but "not available for new customers" and discontinued on 2027-01-01. Source: https://developers.google.com/custom-search/v1/overview
- Verdict: dead end for a new integration.

### B3. `apify/google-search-scraper` (already in the stack)
- $1.80 per 1 000 scraped result pages (pay per event), extra for AI modes and enrichment; input `queries`, `maxPagesPerQuery`, `countryCode`, `languageCode`; run duration not stated. Source: https://apify.com/apify/google-search-scraper
- In this repo: `src/recipe/sources/google-search.ts` (`resultsPerPage: 10`, `timeoutSecs: 90`); the adapter polls `waitForFinish` up to 60 s. Memory from the deploy session calls the SERP step slow. ASSUMPTION: 5 to 20 s per run.

### B4. `harvestapi/linkedin-profile-search` (Apify, LinkedIn people search without cookies)
- Inputs: `searchQuery`, `firstNames`, `lastNames`, `currentCompanies`, `locations`, job-title and school filters. Output per profile: `linkedinUrl`, `firstName`, `lastName`, `headline`, `location` (parsed), experience and more. "No cookies or account required." Pricing: "$0.10 per search page" in short mode, "from $50 per 1 000 search page results"; full mode adds $0.004 per profile. Latency not stated. Source: https://apify.com/harvestapi/linkedin-profile-search
- Rating 5.0 from 2 reviews, >99 % successful runs, 860 monthly users (search snippet of the actor store, 2026-10). Source: https://apify.com/harvestapi
- It is a filter/list actor (job titles, companies, locations); its own page points to a separate "Profile Search by Name" actor for full names, whose id the agent could not find. Name-lookup actors that exist are slow: `neuralverge/neuralverge-linkedin-by-domain` takes 30–70 s per lookup at $0.01 (https://apify.com/neuralverge/neuralverge-linkedin-by-domain); `curious_coder/linkedin-people-search-scraper` needs LinkedIn cookies.
- Risk: it reads LinkedIn's own search results (however the vendor does it). LinkedIn v. Nubela (Proxycurl) ended with the service shut down on 2025-07-04 after a January 2025 suit alleging fake accounts and non-public data. Source: https://nubela.co/blog/goodbye-proxycurl/amp , https://www.unipile.com/proxycurl-alternative/ . The brief's hard rule is "public data only, no fake accounts": a SERP snippet of a public profile is safer ground than a vendor's LinkedIn search.

### B5. Public-profile SERP title shape
- Google and Brave index public profiles as `Name - Headline - Company | LinkedIn` or `Name - Company | LinkedIn` or `Name | LinkedIn`, URL `https://<cc>.linkedin.com/in/<handle>` (country subdomain varies). `normalizeLinkedinProfile` already folds hosts and locale suffixes. ASSUMPTION on the exact separator (` - ` vs ` – `); the parser accepts both.

### B6. Typeahead UX against a slow or paid source
- Standard practice when each lookup costs money or seconds: explicit trigger (Enter or button), minimum 3 characters, one in-flight request with the latest result winning, no per-keystroke calls. This matches the ARES lookup on the register page (button, not on-type). Source: project precedent `src/app/register/company-fields.tsx`; general practice (ASSUMPTION, no single citation).
