# 02 — Case studies: name to LinkedIn URL in the wild

## Classic era
1. **Clay, "Find & Enrich Person from Google Search"** — input is "name company" typed like a normal Google query; Clay's waterfall tries 150+ providers and its agent (Claygent) browses Google to find and verify the profile when structured enrichment has no URL. Claygent costs 1 action plus 0.2–7.5 credits per row (≈ $50 per 1 000 rows on the cheapest model). Community threads report URLs that 404 or belong to a different person, and domain lookups landing on the wrong subsidiary (https://community.clay.com/x/support/7stmyii5f5hm/issues-with-clays-linkedin-url-accuracy-for-employ). Lesson: the search-engine path is the fallback of record for the biggest enrichment product, and they frame it as "find and verify", never "this is the person". Sources: https://community.clay.com/x/support/x6x3eqeoopyg/alternative-methods-to-find-linkedin-urls-using-cl , https://www.clay.com/tools/find-social-profiles-by-email
2. **Proxycurl (Nubela), 2016–2025** — the most used LinkedIn data API; LinkedIn sued in January 2025 (CFAA, fraud, fake accounts), the service shut down 2025-07-04 and the founder wrote that there was no winning against Microsoft's war chest. Lesson: anything that reads linkedin.com at scale, however "no cookies" it claims, carries a shutdown risk that a hackathon brief with a "public data only" rule should not depend on for the first screen. Sources: https://nubela.co/blog/goodbye-proxycurl/amp , https://nubela.co/blog/what-is-proxycurl-api-now-in-2026-im-the-founder/
3. **Apollo / Lusha / hireEZ** — own indexes plus a Chrome extension that reads the page the recruiter is already on; the URL is never typed, it is captured. Lesson: this repo already has that path (plans/004 extension). The typeahead serves the recruiter who starts from a name, not from an open tab. (Vendor claims, not independently verified.)

## Search-API experience
4. **Google Custom Search JSON API** — closed to new customers, discontinued 2027-01-01 (https://developers.google.com/custom-search/v1/overview). Teams that depended on it are migrating to Brave, Serper or SerpApi. Lesson: pick a provider with a published roadmap; keep the provider behind one function so a swap is one file.
5. **Brave Search API relaunch 2026** — tiers were consolidated into a credit model (≈1 000 free queries per month, $5 per 1 000 after). Lesson: cheap, but the free tier is small; one recruiter demo day fits, an unbounded typeahead does not. Cap per account.
6. **Apify small-run latency** — a run is queued, a container starts, the actor runs, the dataset is read; the repo's own adapter polls `waitForFinish` up to 60 s and the deploy memory notes a slow SERP step. Lesson: fine for a research step, poor for a form field.

## Agentic era (2024+)
0. **Deepline "find LinkedIn profile" play** — for ambiguous names it pulls the candidate profile and checks job history and current employer against the input to reject the wrong "Sarah Chen" (https://deepline.com/docs/plays/task-find-linkedin-profile). Lesson: this is exactly what the seed step plus identity resolution already do after the pick; the picker does not need to.
0b. **Mock layer before live APIs** — one developer reports ≈ $3 000 spent testing agents against live APIs before adding a mock layer (https://dev.to/dpelleri/stop-burning-money-on-ai-tests-build-a-smart-mock-system-in-15-minutes-4c21). Lesson: the handler test fakes the provider; no test ever calls Brave.
7. **This repo, plan 009 (ARES lookup)** — handler takes `{db, fetchJson, now}`, the test fakes D1 by SQL prefix and fetch by URL; a cheap model built it in one night and the critics scored the UI 4+. Lesson: copy the shape; the suggest handler is the same pattern with a different parser.
8. **Clay's agent-based fallback** — a browsing agent is the last resort, not the first, because it is slow and costly per row. Lesson: deterministic parse of one SERP call first; no LLM in the typeahead.

## Lessons
- Search-engine snippets of public profiles are the industry's own fallback path; present them as candidates to pick, not as identity.
- Keep the provider swappable behind one function; Google's API death and Proxycurl's shutdown both happened inside two years.
- Trigger explicitly, cap per account, show the source ("via web search").
- Never read linkedin.com for the picker; the seed step scrapes the one chosen URL as today.
- The common failure is a plausible URL for the wrong person; the picker shows the handle and headline, and the run's identity step remains the verifier.
- Latency decides the UX: under one second allows a list that feels native; five seconds and more needs a button and a spinner.
- No LLM in the loop; the parser is pure and tested.
