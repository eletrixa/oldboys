# 01 — Baseline: where a hiring run spends its time (production ledger, 2026-10-08/09)

Source: D1 `ledger_entries` on the production database (read-only queries, `ts > 2026-10-07`), 11–12 finished hiring runs. `ms` is the step's own duration; wall clock is `max(ts) - min(ts)` per run.

## Per-run wall clock (finished runs, newest first)

| run | role | wall s | sum of step s | USD | lineup pause |
|---|---|---|---|---|---|
| 78917623 | CEO / Managing Director | 484 | 517 | 0.80 | no |
| c28095b3 | Head of Sales | 310 | 292 | 0.24 | yes |
| 969a1686 | Software Engineer | 367 | 441 | 0.43 | no |
| 7528db5c | Head of Sales | 604 | 211 | 0.20 | yes (human wait) |
| d994339e | CMO | 266 | 264 | 0.23 | yes |
| c43ddbf4 | CMO | 189 | 239 | 0.21 | no |
| 597867c5 | CMO | 289 | 300 | 0.28 | yes |
| 3f930497 | UX UI designer | 144 | 125 | 0.02 | yes |
| fac97bb6 | UX designer | 190 | 100 | 0.00 | yes |
| a84c7664 | UX designer | 188 | 149 | 0.00 | yes |

Without a human pause a run takes **3–8 minutes**. "Sum of steps" above wall clock means the batches overlap; below it means the run waited (lineup, Workflow scheduling).

## Per-step duration (avg / max ms, n runs)

| step | kind | n | avg ms | max ms | avg USD |
|---|---|---|---|---|---|
| serp_person | call | 12 | 40 650 | 90 775 | 0.001 |
| synthesize_report | llm | 11 | 40 428 | 168 704 | 0.111 |
| translate | llm | 3 | 30 471 | 53 596 | 0.081 |
| press_serp | call | 3 | 30 375 | 61 168 | 0.001 |
| youtube_channel | call | 11 | 29 345 | 45 758 | 0.003 |
| social_serp | call | 12 | 26 068 | 61 739 | 0.001 |
| extract_claims | llm | 11 | 25 273 | 71 364 | 0.076 |
| talks_serp | call | 11 | 20 859 | 51 829 | 0.000 |
| personal_site_crawl | call | 11 | 17 814 | 45 552 | 0.004 |
| x_profile | call | 11 | 12 578 | 37 254 | 0.001 |
| verify_claims | llm | 11 | 8 698 | 31 588 | 0.015 |
| resolve_lineup | llm | 12 | 7 167 | 15 661 | 0.016 |
| seed_profile | call | 8 | 6 443 | 8 405 | 0 |
| employer_company | call | 3 | 5 428 | 9 113 | 0.001 |
| linkedin_posts | call | 3 | 5 277 | 8 132 | 0 |
| role_sites_serp | call | 4 | 3 653 | 14 413 | 0 |
| role_questions | llm | 10 | 3 620 | 7 719 | 0.007 |
| instagram_profile | call | 11 | 3 024 | 6 999 | 0 |
| linkedin_profile | call | 11 | 2 919 | 13 445 | 0.001 |
| cz_registries | call | 3 | 2 318 | 2 541 | 0 |
| openalex_author | call | 11 | 1 800 | 2 480 | 0 |
| github_profile | call | 11 | 662 | 3 584 | 0 |
| orcid_search | call | 11 | 596 | 1 822 | 0 |
| bluesky_profile | call | 11 | 440 | 1 045 | 0 |
| stackexchange_profile | call | 11 | 308 | 496 | 0 |
| huggingface_profile | call | 11 | 191 | 343 | 0 |
| tiktok_profile, github_deep, facebook_page, github_apify | call | | < 100 | | 0 |

`serp_person` hit its 90 s actor timeout in both runs below and returned **nothing** (gap "request failed: … TIMED-OUT"). That is the single worst line: 90 s of pure waiting on the critical path before the lineup.

## Timeline, run 969a1686 (Software Engineer, 367 s, no pause)

```
+0    seed_profile          7.4 s   (harvestapi LinkedIn scrape of the given URL)
+0    role_questions        0.1 s   (catalog template hit, no model call)
+0    serp_person          90.8 s   TIMED OUT, 0 sources          ─┐ sequential
+91   social_serp          49.2 s   (5 site: queries, one actor run)│ pre-lineup
+140  resolve_lineup        6.9 s   (Opus)                          ─┘
+147  batch 1  linkedin_profile(seed reuse) github_* employer_company 7.1 s linkedin_posts 8.1 s   → 12 s
+159  batch 2  huggingface stackexchange orcid openalex tiktok facebook instagram  (all < 3 s)       → 3 s
+159  batch 3  x_profile 33.9 s  youtube_channel 45.6 s  bluesky                                     → 46 s  (waits for YouTube)
+205  batch 4  cz_registries 2.5 s personal_site_crawl 9.6 s role_sites_serp 14.4 s talks_serp 18.3 s → 18 s
+223  batch 5  press_serp 10.6 s                                                                     → 11 s
+234  extract_claims       23.3 s   (Opus, 60k-char prompt)
+258  verify_claims         6.7 s   (Sonnet ×2: second model, devil's advocate)
+264  synthesize_report   102.6 s   (Sonnet protected check → Opus summaries → Opus profile a → Opus profile b)
+367  done
```

Critical path = 7 + 140 + 7 + 87 + 133 = **374 s of which the subject's identity was known at +7 s**.

## Timeline, run 78917623 (CEO, 484 s, no pause)

```
+0    seed_profile 8.4 s
+0    serp_person 90.3 s TIMED OUT
+91   social_serp 61.7 s (19 sources)
+152  resolve_lineup 7.8 s
+160  batches … youtube 7.4 s, talks_serp 12.9 s, press_serp 19.3 s          (52 s of batches)
+212  extract_claims 71.4 s   (54 claims, $0.217 → ~7k output tokens incl. thinking)
+284  verify_claims 31.6 s    (2 calls)
+315  synthesize_report 168.7 s (4 calls, $0.497)
+484  done
```

LLM tail = 272 s = 56 % of the run.

## What the ledger cannot show (measure before trusting)

- Output vs thinking tokens per LLM call (only USD is recorded). Cost arithmetic: extract on the CEO run was ~15k input ($0.06) + ~7.5k output tokens ($0.15); at Opus 5.5's ~75 tok/s that is the whole 71 s, so output (claims + hidden reasoning) is the cost, not input.
- Cloudflare Workflow scheduling overhead per `step.do`: the ledger gaps between consecutive steps are 0–1 s, so it is not the problem today.
- `instagram_search` / `facebook_search` (uncommitted as of this dossier) have no production timings yet; both carry a 90 s actor timeout and sit **sequentially** before the lineup.
