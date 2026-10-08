# 01 — Deep dive (codebase + docs + experience)

Collected 2026-10-08. Versions: `apify-client` 2.25.0, `ai` 7.0.134, `@ai-sdk/anthropic` 4.0.77, `@anthropic-ai/sdk` 0.132.1.

## Codebase
Empty repo. No git. Constraints come from `docs/brief.md` (hard rules), `docs/02-discovery.md` (assumptions A1–A11), `docs/03-pre-mortem.md` (tigers T1–T11).

## Apify access

### `apify-client` (JS)
- `client.actor('owner/name').call(input, opts)` blocks until finish (`waitSecs` caps). `start()` returns immediately. [docs](https://docs.apify.com/api/client/js/reference/interface/ActorCallOptions)
- Start options: `memory` (MB), `timeout` (s), `maxItems` (pay-per-result cap), `maxTotalChargeUsd` (pay-per-event cap), `waitForFinish` (≤60 s). [docs](https://docs.apify.com/api/client/js/reference/interface/ActorStartOptions)
- Results: `client.dataset(run.defaultDatasetId).listItems({limit})` → `{items,total}`.
- Cost after run: `ActorRun.usageTotalUsd`, `chargedEventCounts`, `stats`. [docs](https://docs.apify.com/api/client/js/reference/interface/ActorRun)
→ Everything needed for ledger + budget cap is first-class.

### Apify MCP server
- `https://mcp.apify.com`, Streamable HTTP, Bearer token or OAuth. Pick actors via `?tools=apify/instagram-scraper,...`. [docs](https://docs.apify.com/platform/integrations/mcp)
- `call-actor` waits `waitSecs` 0–45 and **returns run status + storage IDs, not output**; agent must then call `get-actor-run` + `get-dataset-items`. 30 req/s limit.
- No documented per-call `maxTotalChargeUsd` through MCP (ASSUMPTION). Positioned for Claude Desktop / IDE clients; no official server-side TS example.
→ For a server-side TS app, MCP adds a hop and a poll loop you'd write anyway with `apify-client`, and loses the cost cap.

### Actors (verified listings)
| Actor | Input | Output | Price | Note |
|---|---|---|---|---|
| `apify/google-search-scraper` | `queries`, `maxPagesPerQuery`, `countryCode`, `languageCode` | `organicResults{title,url,description,position}`, `peopleAlsoAsk`, `relatedQueries` | $1.80 / 1k SERP pages | 100% success, 200k users |
| `apify/instagram-profile-scraper` | `usernames[]` | followers/follows/posts counts, `biography`, `fullName`, `verified`, `externalUrl`, `latestPosts`(≤12) | $2.60 / 1k | public only |
| `apidojo/tweet-scraper` (V2) | `twitterHandles`, `searchTerms`, `maxItems`, `start/end` | tweet text, counts, author{handle,verified,followers}, createdAt | $0.40 / 1k, **min 50 tweets charged per query**; free plan 5 runs/mo | 3.86★ |
| `apify/website-content-crawler` | `startUrls`, `maxCrawlPages`, `maxCrawlDepth`, `saveMarkdown` | `url`, `text`, `markdown`, `metadata{title,author}` | ~$0.2–5 / 1k pages | 99.7% |
| `harvestapi/linkedin-profile-scraper` | `urls` / `publicIdentifiers` / `queries` | summary, experience, education, skills | $4 / 1k | no cookies, 4.63★, 78k users |
| `apimaestro/linkedin-profile-detail` | `username` | basic, work history, education | $5 / 1k | no cookies, 4.71★ |

LinkedIn authwall: datacenter IPs get authwall/403 ([nubela](https://nubela.co/blog/tutorial-how-to-build-your-own-linkedin-profile-scraper-2020/), [scrapfly](https://scrapfly.io/blog/how-to-scrape-linkedin/)). No-cookie actors route around it internally; listings say 100% success but publish no field-level fill rate. ASSUMPTION: expect partial profiles. **E1 at kick-off stands.**

## ARES v3 (verified live with curl)
- Base `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest`. OpenAPI at `/v3/api-docs`. No auth.
- `GET /ekonomicke-subjekty/{ico}` → `ico`, `obchodniJmeno`, `sidlo{textovaAdresa,nazevObce,psc}`, `pravniForma`, `datumVzniku`, `dic`, `czNace2008[]`.
- `POST /ekonomicke-subjekty/vyhledat` `{"obchodniJmeno":"Alza","pocet":2}` → `{pocetCelkem, ekonomickeSubjekty[]}`.
- **Statutory bodies are in ARES v3**: `GET /ekonomicke-subjekty-vr/{ico}` → `zaznamy[0].statutarniOrgany[].clenoveOrganu[]{fyzickaOsoba{jmeno,prijmeni,datumNarozeni,adresa}, clenstvi.funkce.nazev, datumZapisu, datumVymazu}`. Filter `datumVymazu == null` for current. Also `spisovaZnacka`, `zakladniKapital`, `akcionari`.
- Limit: >500 queries/min may be cut (MF). → A8 risk drops: person↔company via name match on `clenoveOrganu`, no justice.cz scraping.

## Streaming + structured output

### Vercel AI SDK 7
- `streamText({ model, output: Output.array({ element: ZodSchema }) })` → `result.elementStream` yields each **completed, validated** element. `Output.object` → `partialOutputStream`. [docs](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- Tools: `tool({ description, inputSchema, execute })`, multi-step via `stopWhen: stepCountIs(n)`; `onStepEnd` hook for per-step telemetry. [docs](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- Custom data parts: server `createUIMessageStream` → `writer.write({ type: 'data-claim', id, data })` (same `id` = update in place) → `createUIMessageStreamResponse`. Client `useChat` reads `message.parts` by type or `onData`. [docs](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data)
- Anthropic provider: `@ai-sdk/anthropic`, `structuredOutputMode: 'outputFormat' | 'jsonTool'`.

### Anthropic SDK direct
- `client.messages.parse({ ..., output_config: { format: zodOutputFormat(Schema) } })` → `parsed_output`. Strict tools `strict: true`. GA. [docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- **Citations API**: char-range pointers into supplied documents; Anthropic reports +15% recall vs custom; Endex: source hallucinations 10% → 0%. [docs](https://claude.com/resources/articles/introducing-citations-api) → candidate for the verify/extract seam: pass excerpts as documents, get claims with char-range citations for free.

## Experience reports (2024–2026)

### Loop vs pipeline
- Anthropic "Building effective agents": start with simplest pattern that passes evals; agents justified only when steps unknowable *and* each turn gives verifiable feedback. Most successful teams used simple composable patterns, not frameworks. [link](https://www.anthropic.com/research/building-effective-agents)
- Anthropic multi-agent research postmortem: early failures = 50 subagents for simple queries, endless scouring for nonexistent sources; multi-agent ~15× tokens of chat; full tracing was the debuggability fix; final design = bounded research loop, then **separate CitationAgent**. [link](https://www.anthropic.com/engineering/multi-agent-research-system)
- "When Agents Do Not Stop" (arXiv 2607.01641): every infinite-loop failure = repeated path not covered by a strong bound. [link](https://arxiv.org/pdf/2607.01641)
- Convergence write-up: coverage checklist + hard budget cutoff is "the backstop every production system needs". [link](https://tianpan.co/blog/2026-04-12-deep-research-agents-orchestrating-multi-step-search-that-converges)
- OpenAI deep research: self-reported hallucination + weak confidence calibration. [link](https://openai.com/index/introducing-deep-research/)
- Cost anecdote: web-research agent burned $400 in 12 min (single-author case study). "$47k ping-pong" story: no primary source, ASSUMPTION/unverified.

### Citation hallucination
- Tow Center: 8 AI search engines, 1,600 queries, >60% wrong citations; Grok-3 94%. [link](https://www.cjr.org/tow_center/we-compared-eight-ai-search-engines-theyre-all-bad-at-citing-news.php)
- Deep-research agents: 3–13% URLs hallucinated, 5–18% non-resolving; `urlhealth` self-correction → <1%. [link](https://arxiv.org/abs/2604.03173)
- RefLens: verification by direct quotes from source docs. [link](https://huggingface.co/papers/2605.27700)
- OSINT survey (arXiv 2607.03233): hallucination measured end-to-end in only one system; recommends co-pilot where LLM triages, human verifies.
→ Cheapest robust pattern: claim carries `{source_id, exact_quote}`; deterministic `normalize(quote) ⊂ normalize(excerpt)` + URL from ledger only; second model adjudicates residue.

### Entity resolution
- Username enumeration is the cheap half; confirmation is the work; existence checks produce candidates, not identities. [link](https://maxintel.org/username-osint-guide-2026.html)
- "Merge everything with same name" = catastrophic FPs; model as graph. [link](https://knogin.com/en/developers/privacy-preserving-entity-resolution)
- pHash fails some resizes; SIFT fails CG images (Goga et al.). Username Levenshtein + classifier 92% acc on 318k IG accounts. LLM+structural hybrid (LEAD) F1 96.7% on author disambiguation.
- ASSUMPTION: no measured numbers for LLM-only namesake disambiguation on social profiles. Hybrid (anchor → cross-link → avatar hash → LLM tie-break) inferred.

### Hackathon + agentic-era stack evidence
- Muxin Li, Opus 4.7 hackathon, no working demo: Claude Code over-built infra; subagents "check boxes, miss goal"; worktrees caused git chaos; over-speccing as harmful as under-speccing. [link](https://humaninference.substack.com/p/why-i-didnt-win-the-opus-47-hackathon)
- GitHub Octoverse 2025: 94% of LLM compile errors are type-check failures; TypeScript #1 on GitHub. [link](https://github.blog/ai-and-ml/llms/why-ai-is-pushing-developers-toward-typed-languages)
- arXiv 2602.17955: agents use `any` 9× more than humans → enable strict / `noImplicitAny`.
- Next.js + AI SDK `useChat` + streaming described as "same-day project" for multi-turn agent. Pydantic AI has a Vercel-AI-stream adapter. Claude Agent SDK needs standalone runtime (spawns process).
- ASSUMPTION: no controlled "fastest in one night" comparison. Indirect: one typed language end-to-end, strict TS, deterministic test for citation checker.
