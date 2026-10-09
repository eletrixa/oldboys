# 02 — External research: what the platforms allow and what they cost (collected 2026-10-09)

Four fact sheets (Cloudflare, Apify + SERP market, Anthropic, code audit) condensed. Vendor figures are marked; "undocumented" means nobody publishes a number and we must measure it ourselves.

## Cloudflare Workflows, Workers, D1, R2

| Fact | Value | Source |
|---|---|---|
| `Promise.all` of several `step.do` in one run | allowed ("normal JS control flow, promises"); no concurrency cap or measured speedup published | https://developers.cloudflare.com/workflows/build/workers-api/ |
| Per-step overhead | undocumented; our ledger shows 0–1 s gaps | measured, 01-BASELINE |
| Steps per run (Paid) | 10 000 (ours ≈ 40–60) | https://developers.cloudflare.com/workflows/reference/limits/ |
| Step return size | 1 MiB | same |
| Compute time per step | 30 s default, up to 5 min; waiting on I/O is free | same |
| Default step retry | 5 retries, 10 s, exponential, 10 min timeout per attempt (we set 1 retry / 5 s on collectors) | https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/ |
| Simultaneous outbound connections | **6 waiting for response headers** per invocation; a 7th queues; whether parallel steps share it is undocumented | https://developers.cloudflare.com/workers/platform/limits/ |
| D1 per-query latency | undocumented; one DB processes queries one at a time; `batch()` = one round trip, one transaction | https://developers.cloudflare.com/d1/worker-api/d1-database/ |
| D1 read replication | reads only; no help for the append-only ledger | https://developers.cloudflare.com/d1/best-practices/read-replication/ |
| R2 put latency | undocumented; a competitor's benchmark says ~200 ms p50 for 1 KB; unique keys avoid the 1 write/s same-key cap | https://www.tigrisdata.com/docs/overview/benchmarks/cloudflare-r2/ (vendor-biased) |

Rules that bind any restructuring: step names are cache keys (deterministic, unique per run), a retried step re-runs its side effects (ours are idempotent upserts), code outside `step.do` may re-run after an engine restart.

## Apify and the SERP market

| Fact | Value | Source |
|---|---|---|
| Apify actor cold start | undocumented; our floor is 3–6 s (LinkedIn, Instagram actors) | measured |
| Memory | CPU scales with memory (1 core per 4 GB); more memory ≈ faster Crawlee runs for the same compute units | https://docs.apify.com/platform/actors/running/usage-and-resources |
| Standby mode | one long-lived run answers HTTP; confirmed only for `apify/rag-web-browser` (16–22 s per query, no faster) | https://docs.apify.com/platform/actors/running/standby |
| `run-sync-get-dataset-items` | 408 after 300 s, no run status on drop; saves one round trip, no latency gain | https://docs.apify.com/api/v2/act-run-sync-get-dataset-items-post |
| `apify/google-search-scraper` | $1.80 / 1 000 result pages; no published duration; we measure 20–90 s; stores full HTML on every run; several queries per run, parallelism unverified | https://apify.com/apify/google-search-scraper |
| **Serper.dev** | "1–2 s" (vendor); ≈ $1 / 1k at entry, $0.30 at scale; Google organic (title, link, snippet), `site:` works; 2 500 free | https://serper.dev |
| **Brave Search API** | ~0.6 s avg (third-party); $5 / 1k, $5 free credit monthly; own index (title, url, description); 50 QPS; `BRAVE_SEARCH_KEY` already exists for plans/011 | https://brave.com/search/api/ , https://openbenchmarks.com/web-search/fastest-search-api |
| Exa / Tavily | 0.25–0.65 s; neural, not a Google SERP; `site:` semantics differ | same benchmark |
| YouTube Data API v3 | search.list ≈ 100 units, default 10 000 units/day (≈ 100 searches); sub-second (estimate); `channels.list` / `videos.list` cheap for stats on known ids | https://developers.google.com/youtube/v3/determine_quota_cost |
| Jina Reader `r.jina.ai` | 7.9 s avg (vendor), cached near-instant; 20 RPM keyless, 500 with a free key | https://jina.ai/reader/ |
| Cloudflare Browser Rendering `/markdown` | URL in, markdown out; latency undocumented; $0.09 / browser-hour after 10 free h/month | https://developers.cloudflare.com/browser-rendering/rest-api/markdown-endpoint/ |
| Direct fetch + readability in the Worker | a few hundred ms to 2 s for a static personal site (estimate) | n/a |

## Anthropic API (models in `wrangler.jsonc`: Opus 5.5 primary, Sonnet 5.5 verify)

| Fact | Value | Source |
|---|---|---|
| **Opus 5.5 cannot run without thinking**; default effort is `medium`; thinking tokens are output tokens | `thinking: {type: "disabled"}` → HTTP 400 at every effort | https://platform.claude.com/docs/en/build-with-claude/effort |
| Our adapter | sets no effort, no thinking, no cache control, no speed (`src/adapters/llm.ts`) | code |
| Output speed (Artificial Analysis) | Opus 5.5 ≈ 75 tok/s (medium), 90 (high); Sonnet 5.5 ≈ 110 tok/s; Haiku 4.5 ≈ 106 tok/s | https://artificialanalysis.ai/models/claude-opus-5-5-medium |
| Haiku 5.5 | exists (`claude-haiku-5-5`), "Fastest", $0.10 / $0.50 per MTok, thinking can be disabled, 512-token cache minimum (Haiku 4.5 needs 4 096) | https://platform.claude.com/docs/en/models/overview |
| Fast mode | Opus 5.5 only, research preview (waitlist), up to 2.5× output tok/s, 2× price, no TTFT gain; AI SDK `providerOptions.anthropic.speed` | https://platform.claude.com/docs/en/build-with-claude/fast-mode |
| Priority tier / `service_tier` | **not available** on Opus 5.5 or Sonnet 5.5 | claude-api skill |
| `max_tokens` | no effect on speed, not counted toward OTPM; stream at 32k to avoid timeouts | https://platform.claude.com/docs/en/api/rate-limits |
| Prompt caching | 512-token minimum on Opus/Sonnet 5.5; 5 min TTL (write 1.25×) or 1 h (write 2×); reads 0.05×; TTFT gain undocumented; entry usable only after the first response **begins**; **changing `output_config.format` (the Zod schema) invalidates the cache**, as does effort | https://platform.claude.com/docs/en/build-with-claude/prompt-caching , https://platform.claude.com/docs/en/build-with-claude/structured-outputs |
| Structured outputs | AI SDK already uses native constrained decoding on these models (they reject forced tool use); first request per schema compiles a grammar, cached 24 h; `minItems` only 0/1, no min/maxLength, ≤ 24 optional params | https://ai-sdk.dev/providers/ai-sdk-providers/anthropic |
| Rate limits (Start tier) | 1 000 RPM, 2M ITPM, 400k OTPM per model; 6 parallel ~24k-token calls ≈ 150k ITPM, far under; no concurrency limit, only "acceleration" 429 on sharp jumps | https://platform.claude.com/docs/en/api/rate-limits |
| Token arithmetic | ~1.8 tokens/word; a claim with 40-word text + 30-word quote ≈ 160 tokens, the quote ≈ ⅓ of it; 100 claims ≈ 16k tokens ≈ 145–210 s at 75–110 tok/s | models overview (words per MTok) |

## Code audit (src, 2026-10-09; file:line in the agent transcript)

- LLM chain on the critical path, strictly serial today: extract (Opus) → verify second model (Sonnet) → devil's advocate (Sonnet, eligibility computed **after** the second model) → protected-category flag (Sonnet) → summaries (Opus) → profile a (Opus) → profile b (Opus, needs a's risks). A failed profile attempt re-runs **both** profile calls over the top 40 sources (worst case 4 profile calls). Seven serial calls, five on Opus.
- Pre-lineup: `serp_person`, `social_serp`, `instagram_search`, `facebook_search` read only subject/anchor and run **one after another** (`research-run.ts` loop before `resolve`).
- Post-lineup steps that need only subject/role (could start at T+seed): `talks_serp`, `press_serp`, `role_sites_serp`, `cz_registries`, `stackexchange_profile`, `orcid_search`, `openalex_author`, `bluesky_profile`, `huggingface_profile` (subject slug fallback). Need candidates: `linkedin_*`, `github_*`, `x_profile`, `tiktok_profile`, `instagram_profile`, `facebook_page`, `youtube_channel`. Need sources: `employer_company`, `personal_site_crawl`.
- Post-lineup batches: fixed groups of 5 under `Promise.all`; the next batch starts only when the slowest finishes (YouTube 46 s held batch 3 in run 969a1686).
- Per stored source: one R2 put + one D1 insert, **sequential** per hit (`runner.ts` `apply`): a 19-hit SERP step pays 19 × (~200 + ~50) ms ≈ 5 s of storage alone.
- `batch-N` step: full `loadContext` (6 queries, all excerpts) just to compute remaining paid calls.
- Report page: `POLL_MS = 2000`; each poll runs 6 D1 queries including every source excerpt and every ledger row, re-derives everything, no cursor/ETag.
- Paid actor steps against the cap of 18: 4 pre-lineup + 1 seed + 13 post-lineup = 18 exactly.
