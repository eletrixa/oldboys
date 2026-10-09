# 00 — Synthesis: a hiring run in under a minute (Robert, 2026-10-09)

**Question.** How fast can one hiring run (LinkedIn URL + role → sourced profile) be, without giving up a single rule of the brief (every FACT quoted, verify after extract, budget in the runner, public data only)?

**Answer.** Today a run takes 3–8 minutes; the lineup appears at ~2.5 minutes. The subject's identity is known at +7 s, so almost all of that is waiting in series for things that do not depend on each other, plus one actor that times out at 90 s with nothing, plus hidden model reasoning. Three phases get the report to **≤ 90 s p50 and the lineup to ≤ 10 s**, with the same evidence and the same or lower cost. Nothing in Cloudflare, Apify or Anthropic stands in the way; the limits that matter are 6 simultaneous outbound connections per Worker invocation and Opus 5.5's mandatory thinking.

Baseline numbers: `01-BASELINE.md`. Sources for every external claim: `02-RESEARCH.md`.

## Where the 367 s go (run 969a1686, Software Engineer, no human pause)

| segment | s | share | why |
|---|---|---|---|
| seed (LinkedIn scrape of the given URL) | 7 | 2 % | one actor run, the practical floor |
| pre-lineup searches, run one after another | 140 | 38 % | `serp_person` timed out at 90 s with 0 results, `social_serp` 49 s; `instagram_search` + `facebook_search` (uncommitted) will add two more sequential 90 s-timeout actors |
| lineup scoring (Opus) | 7 | 2 % | |
| post-lineup collectors in 5 fixed batches | 87 | 24 % | batch 3 waited 46 s for YouTube while 4 slots idled; batches 4–5 held name-only SERPs that never needed the lineup |
| extract → verify → synthesize, 7 serial model calls | 133 | 36 % | 5 Opus calls at effort medium (thinking on), profile a then b, summaries in between |

## Levers, ranked by seconds saved per unit of risk

| # | lever | saves (p50, s) | cost / risk | phase |
|---|---|---|---|---|
| L1 | Run the four pre-lineup searches concurrently (`Promise.all` of their `step.do`; they read only subject/anchor) | 80–140 → ~50 | none; same requests, same lineup drafts | 1 |
| L2 | Cut the SERP actor timeout from 90 s to 45 s **and** record the timeout as "not searched" (it is already a gap) | up to 45 on the worst runs | a slow Google run that would have finished at 60 s is lost; with L8 moot | 1 |
| L3 | Start every subject-only collector at T+seed, in parallel with the searches: `talks_serp`, `press_serp`, `role_sites_serp`, `cz_registries`, `stackexchange`, `orcid`, `openalex`, `bluesky`, and `linkedin_posts` + `employer_company` when the seed merged a profile (plans/006 always does) | 30–50 | their hits enter `pickDrafts` as lineup drafts (web hits capped at 6, profile platforms ranked first) → the lineup may get *more* candidates, never fewer; `afterResolve` gap logic must treat them as pre-lineup steps | 1 |
| L4 | Replace fixed batches of 5 with a sliding window (next step starts when any finishes; paid-call allowance reserved per start, the existing `planBatch` logic becomes a queue) | 30–45 (no more waiting for YouTube) | one `batch-N` budget read per start instead of per batch; `step.do` names stay deterministic (step id) | 1 |
| L5 | Store parsed hits concurrently (R2 put + D1 insert, 6 at a time) instead of one by one | 3–5 per SERP step, ~10 per run | none; ids are unique keys, upserts idempotent | 1 |
| L6 | `effort: "low"` on every primary call except the lineup (`providerOptions.anthropic.effort`); Haiku 5.5 with thinking disabled for the protected-category flag and the second-model verify | 30–60 across the tail | quality: must pass `pnpm eval` (no new miss, no new lineup question) and a 3-subject FACT-count diff before it ships; keep medium on `resolve_lineup` | 1 |
| L7 | Reorder the tail: second-model verify ∥ devil's advocate (eligibility computed on the deterministic result; both only downgrade, so the union is the same or stricter); protected flag → (summaries ∥ profile a) → profile b | 30–40 | profile a currently reads `kept` after the "contradiction says compatible" drop; move that drop before profile a or let profile a ignore `contradictions` claims (it does not use them) | 1 |
| L8 | SERP provider: Brave Search (key already in prod for plans/011) or Serper for the 5 SERP steps; Apify Google scraper stays as the declared `onEmpty` fallback | 50 pre-lineup + 20–40 post-lineup → ~2 s each | hackathon optics (Apify-judged): platform scrapes stay on Apify, Google is a commodity; Brave's own index covers small personal sites less well than Google → run both for `serp_person` and take the union (hedged request) | 2 |
| L9 | YouTube: `site:youtube.com "<name>"` through the SERP provider, then YouTube Data API `channels.list` for the numbers (free quota) | 29–46 → ~2 | needs a Google API key; the actor stays as fallback | 2 |
| L10 | Personal site: direct `fetch` + readability in the Worker for 1–3 pages, Jina Reader fallback for JS-rendered sites, `website-content-crawler` only when both fail | 10–18 → ~2 | the crawler also finds linked pages; cap at 3 known URLs | 2 |
| L11 | X: lower `maxItems` on `apidojo/tweet-scraper` (profile + 20 tweets, not 100) | 13–34 → ~8 | fewer posts for `social-presence` claims; measure | 2 |
| L12 | Extract in parallel shards (sources split by platform into 2–3 calls, each with the full question list, ids disjoint) | 23–71 → 10–25 | duplicates across shards are already merged by `mergeDuplicates` in verify; output tokens are the same, wall time is the slowest shard | 3 |
| L13 | Quote anchors: the model returns `quote_start` (first 6 words) + `quote_end` (last 6 words) + source id; the runner expands to the verbatim substring deterministically, FACT gate unchanged | ⅓ of extract/profile output tokens → 10–25 | a failed expansion = no quote = INFERENCE (safe direction); prompt and eval change | 3 |
| L14 | Merge summaries into profile a (one Opus call that returns per-question summaries + achievements/risks/history) | 15–25 | larger single output; only worthwhile after L13 | 3 |
| L15 | Progressive report: the page already polls `state` every 2 s; emit `sections` as soon as verify finishes and the profile card when `synthesize` lands, so the recruiter reads evidence while the profile is still generating | perceived 40–60 | UI only | 3 |
| L16 | `state` route: short-circuit on `max(seq)` unchanged (304), drop excerpts from the poll query, keep the full load for the first paint | ~0 run time, less D1 load under 20 parallel runs (plans/010 enrich) | none | 3 |

Not worth it now: Apify Standby (only `rag-web-browser` confirmed, 16–22 s, no gain); Anthropic fast mode (waitlist, 2× price, no TTFT gain, breaks the cache); priority tier (not offered on 5.5 models); prompt caching across extract/profile (a different output schema invalidates the cache, so only identical-schema retries benefit); Durable Objects or Queues for fan-out (Workflows already allow parallel `step.do`).

## Expected critical path after each phase (run 969a1686 shape)

| phase | seed | searches | lineup | collectors | tail | **total** | lineup shown at |
|---|---|---|---|---|---|---|---|
| today | 7 | 140 | 7 | 87 | 133 | **374** | 147 |
| 1 (code only, L1–L7) | 7 | 50 | 7 | 46 | 60 | **≈ 170** | 57 |
| 2 (providers, L8–L11) | 7 | 10–25 (IG/FB name search is the new floor) | 7 | 10–15 | 60 | **≈ 100** | 20–35 |
| 3 (tail, L12–L15) | 7 | 10–25 | 7 | 10–15 | 30 | **≈ 60–75** | 20–35 |

Phase 1 alone halves the run with zero provider change and zero new cost. The floor after phase 3 is set by three things we do not control: one LinkedIn scrape (6 s), the Instagram/Facebook name searches (actor runs, 10–30 s, no non-Apify way to do them in the brief's rules), and ~25 s of Opus output for extract + profile. "Faster than light" ends at about 60 s; the rest is physics and Apify containers.

## How it is built (phase 1 is one PR, the others one each)

1. **Dependency-driven scheduler in `research-run.ts`** replaces the "before/after resolve" split. Each step declares `needs: "subject" | "lineup" | "sources"` in `Step` (`src/recipe/step.ts`); the scheduler keeps a window of `PARALLEL` running steps, starts a step as soon as its need is met, reserves a paid call per paid start (the pure `planBatch` becomes `planNext(pending, running, remaining)` in `src/recipe/batch.ts`, tested), and `resolve` runs when the four searches are done. `step.do` names stay the step ids. Gap logic: `unconfirmed` applies only to steps that started after resolve. Under the 6-connection rule the window stays at 5–6; REST collectors inside a step already fan out to 6, so a step's inner concurrency counts against the same cap (measure, the docs do not say).
2. **`src/adapters/llm.ts`**: `effort` per call (`low` default, `medium` for `resolve`), `thinking: disabled` on Haiku 5.5 calls, `LLM_MODEL_FLAG=claude-haiku-5-5` var; usage (`inputTokens`, `outputTokens`, thinking share if reported) written into the ledger `ref` so the next audit does not need cost arithmetic.
3. **`verify.ts` / `synthesize.ts`**: `Promise.all` for the independent calls as in L7; `profile.ts` unchanged except the entry point.
4. **`runner.ts`**: `apply` stores hits through a 6-wide pool; order of `out.sources` preserved.
5. **Phase 2 collectors** are new `Collector`s (`rest/brave-serp`, `rest/youtube-data`, `rest/site-fetch`) selected by recipe step `actor`; the Apify actor remains the `onEmpty.fallbackStep` so the ledger says which lane answered. `BRAVE_SEARCH_KEY`, `YOUTUBE_API_KEY` as Worker secrets.
6. **Phase 3** edits the extract/profile prompts and schemas; it goes through `pnpm eval` and a 3-subject before/after FACT diff like any prompt change.

## Benchmarks and gates (so "fast" stays a number, not a feeling)

- **`pnpm bench:latency`** (new script, reads D1 via `wrangler d1 execute --json`): per run prints the timeline as in `01-BASELINE.md` and the three headline numbers: `t_lineup` (seed start → resolve end or pause row), `t_report` (seed start → finish), `t_tail` (extract start → finish). Runs it over the last N runs; the dossier's baseline is its first output.
- **Reference subjects**: Robert (`rvojacek`), Minas (`minasarustamyan`), Dušan Šenkypl (CEO run above) — one technical, one management, one public figure. Each phase lands only with a before/after table on all three and a claim diff (`FACT` count per question must not drop; `pnpm eval` green; no new lineup question).
- **Targets**: phase 1 `t_report` p50 ≤ 180 s, phase 2 ≤ 100 s, phase 3 ≤ 75 s; `t_lineup` ≤ 60 / 30 / 30 s. Any step over 45 s is a bug, not a wait.
- **Cost gate** unchanged: $0.50 and 18 paid runs per run, enforced in the runner. Phase 2 lowers paid runs (SERPs become free REST), which frees allowance for the social scrapes.

## Decisions for Robert

1. **Google SERP off Apify** (L8). Keep Apify for every platform scrape and as the SERP fallback; use Brave (already keyed) or Serper for Google. Recommendation: Serper for `serp_person`/`social_serp` (Google index, `site:` operators proven), Brave as the second hedge; decide before phase 2.
2. **Effort low on Opus** (L6). Recommendation: yes for extract, summaries and profile; keep medium on the lineup; the eval set decides.
3. **Subject-only collectors before the lineup** (L3). Changes what the lineup sees (more drafts). Recommendation: yes; it only adds candidates, and plans/006 runs rarely pause anyway.

## Non-goals

- Replacing Apify for LinkedIn, Instagram, Facebook, TikTok, X scrapes (no public alternative inside the brief's rules).
- Caching across runs of the same subject (plans/001 replay already serves CACHED ledgers; a cross-run source cache is a different plan).
- Changing the FACT rule, the verify order or the budget owner.
