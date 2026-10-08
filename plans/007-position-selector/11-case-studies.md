# 11 — Case studies and external evidence

Collected 2026-10-08 by a research agent (web search + live `curl` from a residential IP; Workers egress not tested). UNVERIFIED marks what could not be confirmed.

## Fetchability matrix (job posting by URL)
| Board | Method | Reliability | Cost |
|---|---|---|---|
| LinkedIn `jobs/view/<id>` | plain `fetch` of guest `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/<id>`; title in `top-card-layout__title`, description in `show-more-less-html__markup`; **no JSON-LD** | 200 with a `Mozilla/5.0` UA at low volume (tested); from Workers egress UNVERIFIED; 429 at ~10 pages/IP on the search endpoint ([jobspy-js docs](https://www.mintlify.com/borgius/jobspy-js/job-boards/linkedin), [JobSpy review 2026-09-30](https://jobspipe.dev/blog/jobspy-review)) | free |
| LinkedIn | Apify [memo23/linkedin-jobs-scraper](https://apify.com/memo23/linkedin-jobs-scraper): accepts single job view URLs, ~40 fields incl. full description, pay per result, no cookies | reported working; cold start vs 45 s UNVERIFIED | ≈ $0.001 per job (but `maxTotalChargeUsd` floors at $0.50 per run) |
| LinkedIn | Apify [scrape.badger/linkedin-jobs-scraper](https://apify.com/scrape.badger/linkedin-jobs-scraper) "Get Job" by numeric id | per README | $0.003 per job |
| Jobs.cz `/rpd/<id>` | plain `fetch`; **correction 2026-10-09 (Fable, live curl of 3 postings): no JSON-LD.** Title and company sit in `og:title` ("<title> – <company>"), location in `data-test="jd-info-location"`, description in `data-test="jd-body-richtext"` | tested, 200, HTML parse needed | free |
| StartupJobs.cz | JS-rendered; JSON-LD UNVERIFIED; [official API](https://firmy.startupjobs.cz/en/articles/9506864-startupjobs-dev) is per-company token only; Apify [martin1080p/startup-jobs-scraper](https://apify.com/martin1080p/startup-jobs-scraper) is search-only | low | platform usage |
| Greenhouse / Lever / Ashby hosted pages | public JSON: `boards-api.greenhouse.io/v1/boards/<b>/jobs/<id>`, `api.lever.co/v0/postings/<co>/<id>`, `api.ashbyhq.com/posting-api/job-board/<name>`; hosted pages also carry `JobPosting` JSON-LD (Greenhouse, Ashby tested) | tested, 200, no auth | free |
| Generic careers page | JSON-LD `JobPosting` when present ([Google requires](https://developers.google.com/search/docs/data-types/job-posting) title, description, hiringOrganization, jobLocation, datePosted, validThrough), else LLM extraction from text | prevalence UNVERIFIED | LLM only |
| Welcome to the Jungle, Workable, Recruitee | not researched | UNVERIFIED | – |

Harvestapi: `harvestapi/linkedin-job-search` takes titles/locations, not URLs; no `harvestapi/linkedin-job-scraper` found.

## Title clustering
- ESCO has Czech labels and CSV/API ([languages](https://esco.ec.europa.eu/en/escopedia/esco-languages)); O*NET alternate titles are English only; Lightcast Open Titles exists (availability UNVERIFIED).
- Hybrid semantic search + LLM over ESCO reached 73.8 % ISCO-3 accuracy on 225 cases ([arXiv 2505.24640](https://arxiv.org/html/2505.24640v1)); fine-tuned e5 normalisers Recall@1 ≈ 0.37 on 15k titles ([HF model](https://huggingface.co/Misbahuddin/job-title-normalizer-e5-small)). Taxonomy mapping is hard and unnecessary at demo scale; a fixed family enum with LLM assignment is the pragmatic reading.
- No npm normaliser found; no sourced rule-vs-LLM cost comparison.

## Practitioner reports on posting ingestion
- [ScrapingBee job aggregator](https://www.scrapingbee.com/blog/how-to-build-a-job-aggregator/): layouts differ per source, the same role appears on several boards, ghost postings; LinkedIn rate-limits within a few hundred results.
- [JobSpy review](https://jobspipe.dev/blog/jobspy-review): no dedup ("the same role appears on three boards as three rows"), open issue #374 "empty LinkedIn descriptions" (Sept 2026).
- Dedup pattern in ATS actors ([gunmo/direct-source-jobs-scraper](https://apify.com/gunmo/direct-source-jobs-scraper)): company + title + location, keep the ATS requisition id.
- Description boilerplate ("About us", EEO, benefits) should be stripped before must-have extraction (inference, no source).

## Agentic-era note
Nothing specific found for "positions in a sourcing tool built by coding agents". Internal evidence from this repo tonight: five peer agents shipped pure-projection features (`role-overview`, `audit`, `summary`, `identity-map`, `candidate-copy`) in 10–15 min each because each was a pure function + Vitest + thin route. That shape is the one to copy.

## What this settles
1. **URL ingest is viable without Apify for Jobs.cz (HTML markers, not JSON-LD) and the three big ATSs, and probably for LinkedIn** via the guest endpoint; Apify (memo23) is the LinkedIn fallback, with the $0.50 floor making it a real cost per ingest.
2. **Pasted text must stay a first-class input** (StartupJobs, unknown boards, Workers egress risk).
3. **Clustering by taxonomy is out of scope**; a fixed family enum is enough.
4. **Dedup key** for postings: board + external id, else normalised URL; for positions: company + roleKey(title) + location.
