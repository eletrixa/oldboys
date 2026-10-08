# LLM manual run ledger

Every LLM run made on Robert's behalf is recorded. In-app LLM calls land in D1 `ledger_entries` (`kind = llm`, `cost_usd`). Manual, batch, gateway and spawned-agent runs are logged here by hand: when, what, lane, model, actual billed cost. No silent spend.

| when (ISO) | what | lane | model | actual billed cost | notes |
|---|---|---|---|---|---|
| 2026-10-08 | repo scaffold via Claude Code workflow (ultracode) | claude-code | claude-fable-5-1 | subscription, not metered | [plans/002-cloudflare-platform](../../plans/002-cloudflare-platform/00-SYNTHESIS.md) |
| 2026-10-08 | Cloudflare provisioning + first deploy of the scaffold to oldboys.asajj.cz (D1 `oldboys`, R2 `oldboys-sources`, Workflow, secrets). No model calls made by the worker yet. | claude-code | claude-fable-5-1 | subscription, not metered | `APIFY_TOKEN` in prod is the Groupon-lane Apify key (Robert's decision 2026-10-08); `RUN_TOKEN` kept in `~/s/oldboys/.env`. |
| 2026-10-08 | plans/005 verification-call backend: planning research (3 explore/research agents, 3 prosecutor agents), 10 implementation agents (sonnet/haiku), orchestration and review in Claude Code. No model calls made by the worker. | claude-code | claude-fable-5-1 (orchestrator), claude-sonnet-5-5 / claude-haiku-4-5 (agents) | subscription, not metered | `scripts/call-smoke.mjs` live run (S7) NOT RUN: no ElevenLabs keys in this session. |
| 2026-10-08 | plans/005 close-out: `/simplify` (4 sonnet agents) and `/code-review high --fix` over f74f892..HEAD (one fork, ~200k tokens, 52 tool uses) plus one targeted reviewer on the fix commit; findings applied in 437199f and 3821d5b. | claude-code | claude-fable-5-1 (review fork), claude-sonnet-5-5 (agents) | subscription, not metered | RUN_TOKEN-in-client-bundle finding left for Robert (product decision). |

Lanes: `claude-code` | `api` | `apify` | `other`.
| 2026-10-08 | CEO review loop iterations 001-003: 3 review agents (opus) writing eval/reviews/NNN.{md,json}; fix agents fix-degrade, fix-identity (opus), fix-screen2 (sonnet) for 001; fix2-logic (opus), fix2-screen (sonnet) for 002; orchestration in Claude Code. Worker made no Anthropic calls (key empty); 6 local Workflow runs on the two demo subjects. | claude-code | claude-fable-5-1 (orchestrator), claude-opus-5-5 / claude-sonnet-5-5 (agents) | subscription, not metered | Apify for the 6 runs ~$0.03 total (lane `apify`, from `usageTotalUsd`). Scores: 2.3 -> 3.1 -> 3.6 -> 3.8 -> 4.1 (reviews 004, 005 + fix3/fix4/fix5 agents, opus). Ceiling without ANTHROPIC_API_KEY: 4.3. |
