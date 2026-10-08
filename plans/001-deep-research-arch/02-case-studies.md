# 02 — Case studies (real-world experience)

Collected 2026-10-08 by research agent. Secondary/unfetched sources marked ASSUMPTION.

## A. Open-source deep research agents

| Project | Stack | Sources/claims | Citation verification | Broke / would change |
|---|---|---|---|---|
| GPT-Researcher (https://github.com/assafelovic/gpt-researcher) | Python; planner → parallel crawlers → publisher; OpenAI + Tavily; BM25 context filter | Each source summarized + tracked; >20 sources/query; inline citations | None built in; README: "experimental, as-is" | Issue #1276: 5–8% wrong citation metadata; #1770 empty-context reports (via hashnode write-up, ASSUMPTION) |
| LangChain Open Deep Research (https://github.com/langchain-ai/open_deep_research) | LangGraph; scope → research (supervisor + parallel sub-agents) → write | Sub-agents return compressed findings, not raw pages; one-shot final write | None; RACE 0.49 on Deep Research Bench | Multi-agent *writing* gave disjoint reports → multi-agent only for research. Raw findings bloat tokens → mandatory compression. Repo archived Aug 2026 |
| HF Open Deep Research (https://huggingface.co/blog/open-deep-research) | smolagents CodeAgent + text browser | No explicit claim/source model | None; GAIA 55% vs 33% JSON actions | Text-only browsing ceiling; 128K context overflows |
| STORM (https://arxiv.org/abs/2402.14207) | Perspective discovery → simulated conversations grounded in search → outline → cited article | References per conversation turn | Human-rated more verifiable; no automated URL check | Named failures: source bias transfer, over-association of unrelated facts |

Cross-cutting: 2026 study (https://www.alphaxiv.org/abs/2604.03173) found **3–13% of citation URLs from deep-research agents never existed**, 5–18% non-resolving. Fix: URL liveness classifier (LIVE / DEAD / LIKELY_HALLUCINATED) + 2–4 self-correction rounds dropped non-resolving 16.0% → 0.6%. **None of the four OSS agents verify citations by default.**

## B. Commercial enrichment / due diligence

- **Hunter.io** (https://hunter.io/api-documentation/v2): `score` 0–100 + `sources[] = {domain, uri, extracted_on, last_seen_on, still_on_page}` (≤20) + verifier `status ∈ valid|accept_all|unknown`. Cleanest public evidence model in category.
- **Clay / Claygent**: answer + source URLs + extracted text blocks; optional confidence/reasoning columns; green/red = how fully prompt answered (not calibrated). Waterfall = sequential providers, stop at first hit. Users report hallucination on long multi-step prompts.
- **Apollo**: categorical `verified | likely to engage | unverified | unavailable`. Third-party tests: 3–9% bounces on "verified" (vendor-run, ASSUMPTION).
- **Sayari Graph** (https://documentation.sayari.com/sayari-library/data-model/data-model): entity/relationship/record/attribute; each attribute links to source records ("address found in 6 records"); raw HTML/PDF retained. **Two-tier resolution: confident → merge; uncertain → explicit `possibly-same-as` edge instead of merging.** Pattern to copy.
- **Sixtyfour** (https://docs.sixtyfour.ai/api-reference/endpoint/field-confidence.md): per-field `{confidence 0–100, justification, sources[]}`; replaced single lead-level score.
- **Apify** (https://docs.apify.com/sdk/python/docs/guides/ai-agents): agent templates; results via `Actor.push_data()`; LlamaIndex example pushes `source_nodes[].url` as citations. Store "deep research" actors are thin wrappers, no evidence model.

## C. Fake-account detection (public signals only)

- **Botometer X / Lite** (https://osome.iu.edu/research/blog/introducing-botometer-x): Lite uses user-object metadata only (account age, screen-name length, default avatar, follower/friend counts, status count). Dead after X API cuts; pre-LLM-bot model.
- **Maigret** (https://maigret.readthedocs.io): presence via message strings > status code > response URL; treats anti-bot codes (LinkedIn 999) as not-found; ~3000 sites.
- **SpiderFoot**: documented false attribution of hateful account to same-handle namesake (https://www.sans.org/blog/spiderfoot-and-the-dangers-of-doxing). Reddit: ~99% false positives on names/usernames (anecdotal).
- Takeaway: **username match ≠ identity**; every tool says verify manually. Common signals: account age, follow ratio, cadence, default avatar, cross-platform handle/bio/avatar consistency, reverse image. Nobody ships a calibrated score on public signals post-2023.

## D. Claim / evidence data models

| Model | Shape | Fit for JSON/SQLite |
|---|---|---|
| Wikidata statement (https://www.wikidata.org/wiki/Help:Sources) | claim + qualifiers + N references (stated in, URL, retrieved, archive URL) + rank preferred/normal/deprecated + deprecation reason | Simplest: 3 tables; rank handles contradiction without deleting |
| schema.org ClaimReview | claimReviewed, itemReviewed, reviewRating, author, url | Good for verdicts, weak for raw evidence |
| W3C PROV-DM | Entity/Activity/Agent + derivation relations | Overkill unless auditing *process* |
| Sixtyfour field-confidence | `{value, confidence, justification, sources[]}` | Flattest; no contradiction handling |

**Recommendation from evidence**: Wikidata shape + Hunter-style source rows + Sayari `possibly-same-as` for unmerged identities + URL liveness check before persisting any citation.
