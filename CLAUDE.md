# oldboys — agent context

## Product
Hackathon Case 01 (Apify): social media deep research. Input: a person or organization, one anchor (city, website or IČO) and a goal. Output: a report where every claim links to a source, FACT is split from INFERENCE, gaps are stated, namesakes are handled, and a different goal yields different substance. Judging: value 35, originality 25, e2e 20, tech 10, honesty 10. Brief: `docs/brief.md`.

## Binding decisions
001 (`plans/001-deep-research-arch/00-SYNTHESIS.md`) domain, 002 (`plans/002-cloudflare-platform/`) platform. Where they conflict, 002 wins.

| Topic | Decision |
|---|---|
| Planner | Declared recipe per goal; branches only via `onEmpty` and pausable `resolve` (lineup); `replan` only at T+7h |
| Actors | `apify-client` with 45s timeout and `maxTotalChargeUsd`, never Apify MCP |
| LLM seams | score, extract, verify, synthesize; `Output.array` / `Output.object` |
| Verify | deterministic quote-in-excerpt and URL-in-ledger first, second model on residue |
| Identity | merge / `possibly-same-as` / ask below threshold |
| Claims | claim + references + rank; contradictions via rank, never delete |
| Budget | enforced in runner, never by the LLM: $0.50 and 12 calls per run |
| Runner | Cloudflare Workflow `ResearchRunWorkflow` (binding `RESEARCH_RUN`), one `step.do` per recipe step, `step.waitForEvent` for lineup |
| Ledger | D1 `DB`: `ledger_entries` (append-only, `seq`), `claims`, `gaps`, `candidates`, `investigations` |
| Raw payloads | R2 `SOURCES` (`oldboys-sources/<run>/<source>.json`), only `{sourceId, excerpt}` returned from steps (1 MiB cap) |
| Streaming | SSE route polls D1 `seq > last` every 1s, replays whole ledger on connect, events idempotent by `seq` |
| Replay | serve old ledger, labeled CACHED |

## Stack and bindings
Next.js 16 on Workers via `@opennextjs/cloudflare`; `ai` + `@ai-sdk/anthropic`; `apify-client`; Zod; Vitest; pnpm; Node 26 locally, 22 in CI.
Bindings in `wrangler.jsonc`: `DB` (D1), `SOURCES` (R2), `RESEARCH_RUN` (Workflow), `ASSETS`. Vars: `LLM_MODEL_PRIMARY=claude-opus-5-5`, `LLM_MODEL_VERIFY=claude-sonnet-5-5`, `RUN_BUDGET_USD`, `RUN_BUDGET_CALLS`. Secrets: `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, `RUN_TOKEN` (bearer for POST /api/runs), `ELEVENLABS_API_KEY` (optional).
Worker entry `src/worker.ts` re-exports the OpenNext `fetch` and exports `ResearchRunWorkflow`. The Workflow imports only `src/domain/*` and `src/recipe/*`, never Next.js.

## Scripts (pnpm)
`dev`, `build`, `preview`, `deploy`, `cf-typegen`, `typecheck`, `lint`, `test`, `test:watch`, `db:migrate:local`, `db:migrate:remote`, `check` (= typecheck && lint && test). Do not rename.

## Directory map
- `src/domain/` pure: claim schemas today; `verify.ts` and `resolve.ts` are TODO (001 TDD steps 2–3). No I/O, ports are plain function parameters.
- `src/recipe/` per-goal questions and steps (`goals/*.ts`).
- `src/workflow/` Workflow class and runner adapters.
- `src/app/` Next.js routes and UI.
- `migrations/` D1 SQL.
- `rules/` repo coding rules.
- `plans/` decision dossiers (001, 002).
- `docs/` brief, discovery, ops, cli, architecture pointer.

## Rules
Read `rules/README.md` first; `rules/crossroads.md` routes tasks to rules; every source file carries the header from `rules/file-headers.md`. No interfaces with one implementation. Step file over 150 lines means it is becoming a planner: cut or `replan`.

## Hard rules (from brief)
- Public data only. No fake accounts, CAPTCHA bypass, leaks, DMs, closed groups.
- No inference of GDPR Art. 9 data (health, politics, religion, ethnicity, sexuality). No personality, credit or trustworthiness scores.
- Outreach is drafted and shown, never sent.
- Raw scraped data is purged after judging.
- Cached runs are labeled CACHED; mocks only for unreachable sources, labeled MOCK.
- `Claim.kind = FACT` requires `quote` within a supporting `Source.excerpt` and passed verify.

## Hackathon time gates
- T+1h: `src/domain/claim.ts` (Zod schemas) committed; everything imports it. E1 gate: one `apify-client` `.call()` from `wrangler dev` (fallback: raw `fetch` to run-sync-get-dataset-items).
- E3 goal-delta gate before any UI: at least 50% claim delta between hiring and due-diligence goals; recipes must call different steps.
- T+5h: first end-to-end run.
- T+7h: `replan` only if coverage under 70% on 3 demo subjects.

## Secrets
Local: `.dev.vars` (gitignored, template `.dev.vars.example`). Prod: `wrangler secret put`. Master values live in `~/s/.env.master`; read only the variable needed, never print or copy the file.

## LLM run evidence
In-app calls land in D1 `ledger_entries` (`kind = llm`, `cost_usd`). Manual, batch and agent runs are logged by hand in `docs/ops/llm-manual-runs.md`.

## ps-profile
Shortcuts live in `docs/cli/` (`repojumper/oldboys.ps1` defines `GoOldboys`, `cheat/oldboys.ps1` defines `cheatoldboys` / `oldboyscheat`). Update the cheat file in the same commit whenever `package.json` scripts or `wrangler.jsonc` change. Rule: `~/code/ps-profile/REPO-CONVENTIONS.md`.

## Git
Author `Robert <robert@soulfire.cz>`.

## Definition of done (strict)
Every change to `src/`, `migrations/`, `scripts/` or any root config must pass `pnpm check` (typecheck + lint + test) before the task is reported done. The Claude Code Stop hook in `.claude/settings.json` runs `scripts/agent-check.sh` and blocks the turn when it fails; the same script is the pre-commit hook (`pnpm hooks:install` once per clone). Rules:
- Run `pnpm check` yourself after editing; do not wait for the hook.
- Never skip or weaken a test, lint rule or the hook to get green. Fix the code.
- New code under `src/domain` and `src/recipe` ships with a Vitest test next to it (`__tests__/`).
- Agents may not deploy, migrate remote D1, touch Worker secrets, or read `.dev.vars` or `~/s` (denied in `.claude/settings.json`). Push only when Robert asks in the current task.
- `pnpm exec wrangler deploy --dry-run --outdir <scratch>` is the allowed way to prove the Worker still bundles.

## Known gotchas
- CI deploys on push to main but cannot migrate D1 (token has no D1 scope). A PR that adds a file under `migrations/` must say so; Robert runs `pnpm db:migrate:remote` before merging.
- `next` is pinned exactly to 16.3.8 (`eslint-config-next` stays 16.4.0: its 16.3.8 pulls an eslint-plugin-react that breaks ESLint 10): 16.4 breaks on Workers with OpenNext 1.20.9 (`Unexpected loadManifest(/.next/server/preview-props.json)`). Bump only together with an OpenNext release that includes PR #1356.
- `POST /api/runs` needs `Authorization: Bearer <RUN_TOKEN>`; the value lives in `~/s/oldboys/.env` and in the Worker secret.
