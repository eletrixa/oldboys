# LLM manual run ledger

Every LLM run made on Robert's behalf is recorded. In-app LLM calls land in D1 `ledger_entries` (`kind = llm`, `cost_usd`). Manual, batch, gateway and spawned-agent runs are logged here by hand: when, what, lane, model, actual billed cost. No silent spend.

| when (ISO) | what | lane | model | actual billed cost | notes |
|---|---|---|---|---|---|
| 2026-10-08 | repo scaffold via Claude Code workflow (ultracode) | claude-code | claude-fable-5-1 | subscription, not metered | [plans/002-cloudflare-platform](../../plans/002-cloudflare-platform/00-SYNTHESIS.md) |
| 2026-10-08 | Cloudflare provisioning + first deploy of the scaffold to oldboys.asajj.cz (D1 `oldboys`, R2 `oldboys-sources`, Workflow, secrets). No model calls made by the worker yet. | claude-code | claude-fable-5-1 | subscription, not metered | `APIFY_TOKEN` in prod is the Groupon-lane Apify key (Robert's decision 2026-10-08); `RUN_TOKEN` kept in `~/s/oldboys/.env`. |
| 2026-10-08 | plans/005 verification-call backend: planning research (3 explore/research agents, 3 prosecutor agents), 10 implementation agents (sonnet/haiku), orchestration and review in Claude Code. No model calls made by the worker. | claude-code | claude-fable-5-1 (orchestrator), claude-sonnet-5-5 / claude-haiku-4-5 (agents) | subscription, not metered | `scripts/call-smoke.mjs` live run (S7) NOT RUN: no ElevenLabs keys in this session. |

Lanes: `claude-code` | `api` | `apify` | `other`.
