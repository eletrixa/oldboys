# oldboys — agent context

## Product
Hackathon Case 01 (Apify): social media deep research. Input (hiring, plans/006): the candidate's LinkedIn profile URL or a pasted CV, plus the role; name, location and employer are derived from it and the given profile is the confirmed identity (the extension, curl and due-diligence still send a subject + anchor pair). Output: a report where every claim links to a source, FACT is split from INFERENCE, gaps are stated, namesakes are handled, and a different goal yields different substance. Judging: value 35, originality 25, e2e 20, tech 10, honesty 10. Brief: `docs/brief.md`.

## Binding decisions
001 (`plans/001-deep-research-arch/00-SYNTHESIS.md`) domain, 011 (`plans/011-profile-suggest/`) profile suggestions, 002 (`plans/002-cloudflare-platform/`) platform, 005 (`plans/005-call-verification/`) verification calls, 006 (`plans/006-profile-first/`) profile-first start, 008 (`plans/008-intake-connectors/`, contracts in `specs/intake/`) candidate intake. Where they conflict, 002 wins. Ops runbooks: `docs/ops/call-verification.md` (calls), `docs/ops/intake.md` (intake).

| Topic | Decision |
|---|---|
| Planner | Declared recipe per goal; branches only via `onEmpty` and pausable `resolve` (lineup); `replan` only at T+7h |
| Actors | `apify-client` with 45s timeout and `maxTotalChargeUsd`, never Apify MCP |
| LLM seams | score, extract, verify, synthesize; `Output.array` / `Output.object` |
| Verify | deterministic quote-in-excerpt and URL-in-ledger first, second model on residue, then a devil's advocate call (idea #8) that may only downgrade must-have FACTs; its record lives in the verify ledger row (`ref.challenge`) |
| Identity | merge / `possibly-same-as` / ask below threshold; a merge needs a strong link (given profile or anchor website / IČO, confirmed employer, cross-link to a confirmed profile), name + city alone caps at `possibly-same-as` (`resolve.ts` `corroboration`) |
| Claims | claim + references + rank; contradictions via rank, never delete |
| Budget | enforced in runner, never by the LLM: $0.50 and 16 paid actor runs per run (free REST fetches and LLM calls count USD only) |
| Runner | Cloudflare Workflow `ResearchRunWorkflow` (binding `RESEARCH_RUN`), one `step.do` per recipe step, `step.waitForEvent` for lineup |
| Ledger | D1 `DB`: `ledger_entries` (append-only, `seq`), `claims`, `gaps`, `candidates`, `investigations`, `calls`, `webhook_events`, `organizations`, `accounts`, `sessions`, `auth_attempts`, `ares_cache`, `role_templates` |
| Raw payloads | R2 `SOURCES` (`oldboys-sources/<run>/<source>.json`), only `{sourceId, excerpt}` returned from steps (1 MiB cap) |
| Streaming | SSE route polls D1 `seq > last` every 1s, replays whole ledger on connect, events idempotent by `seq` |
| Replay | serve old ledger, labeled CACHED |
| Verification calls (005) | Operator-approved, operator-entered numbers with recorded consent only; dialed once in `POST /api/calls/:id/approve`, never in a Workflow step; `VerificationCallWorkflow` (binding `VERIFY_CALL`) waits for the ElevenLabs webhook, ingests the transcript as a Source and writes `STATEMENT` claims (never FACT); `CALL_PROVIDER=mock` is labeled MOCK; max `RUN_CALL_MAX` calls per run |
| Role catalog | `src/domain/role-catalog/` (one file per family, `types.ts` contract) is the source of truth for 100+ preselected roles; D1 `role_templates` is seeded from it (`pnpm roles:sql` output pasted into a migration, never hand-edited); `matchRoleTemplate` is whole-phrase on title or alias, never fuzzy; a hit skips the `role_questions` model call and feeds `role_sites_serp` via `StepContext.roleSites` |
| GitHub deep (technical roles) | Hiring steps `github_deep` (`rest/github-deep`, REST, two waves via `Collector.followUp`) and `github_apify` (`saswave/github-profile-scraper`) run only when `StepContext.roleFamily` is in `TECHNICAL_FAMILIES` (engineering, data; `src/domain/code-profile.ts`); the collector's `digest` is written into the step ledger ref and read back as `code_profile` by the state route; numbers are excerpts in plain sentences so FACTs can quote them; stats pending (202) are named, never counted |
| Czech registries | Hiring step `cz_registries` (`rest/cz-registries`, free, no Apify): `src/domain/cz-registry.ts` is the catalog (everyone: ISIR SOAP, ARES name, or.justice.cz persons, Police wanted list; by role title: ČAK, KDP, KAČR, ČKA, ČKAIT, notaries, bailiffs, ČSK, pharmacists, NRPZS; `access: manual` = CAPTCHA/signed access, linked for a hand check: ČLK, ČNB, court experts, vets); one source per registry with a plain-sentence excerpt, hits flagged "namesake possible", never a birth number; digest `registry_checks` in the step ledger row; `LIVE=1 SUBJECT= ROLE= pnpm exec vitest run live-registries` smokes the real sites; the fetch adapter returns text for `accept: text/*` and follows one 302 with its cookies |
| Intake (008) | Every channel (email `jobs+<tag>@asajj.cz` via Email Routing and `worker.email()`, `POST /api/intake/form` with bearer `INTAKE_TOKEN`, hosted `/apply/<tag>` + `POST /api/apply`, `POST /api/intake/startupjobs/<token>`) normalises into `IntakeInput` and calls `ingestApplication`, the only writer of `applications` and the only intake path to `startRun` (`via='intake'`); a run starts only for a known `intake_tags` tag with a LinkedIn URL or readable CV, capped by `INTAKE_PER_HOUR_CAP`; the candidate never sees a run |
| Profile signals (012) | Platform collectors record `ProfileFacts` (`src/domain/profile-facts.ts`) in the step ledger ref `digest` for merged accounts only; `profileSignals` (`src/domain/profile-signals.ts`) derives sentences at read time in the state route (`profile_signals`), shown in a card and the interview kit; rules in `plans/012-fake-profile-signals/00-SYNTHESIS.md`; no model, no score, no verdict words |
| Candidate pool (010) | Tag bound to a position: applications pool (status `pooled`, no auto-start); tag without position: unchanged plan 008 auto-start; manual add via `POST /api/positions/:id/candidates` (LinkedIn URL or CV); `POST /api/positions/:id/enrich` (session or bearer, max 20 ids) starts one run per selected pooled candidate with the position's must-haves, subject to `START_PER_HOUR_CAP` (origin `via='start'`) and global `RUNS_PER_HOUR_CAP`; each run updates application status to `run-started`; migration 0012 rebuilds `applications` (`position_id` added), adds `position_id` to `intake_tags` |

## Stack and bindings
Next.js 16 on Workers via `@opennextjs/cloudflare`; `ai` + `@ai-sdk/anthropic`; `apify-client`; Zod; Vitest; pnpm; Node 26 locally, 22 in CI.
Bindings in `wrangler.jsonc`: `DB` (D1), `SOURCES` (R2), `RESEARCH_RUN` and `VERIFY_CALL` (Workflows), `ASSETS`. Vars: `LLM_MODEL_PRIMARY=claude-opus-5-5`, `LLM_MODEL_VERIFY=claude-sonnet-5-5`, `RUN_BUDGET_USD`, `RUN_BUDGET_CALLS`, `CALL_PROVIDER` (`mock`|`elevenlabs`), `CALL_BUDGET_USD`, `RUN_CALL_MAX`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER_ID`, `POSITION_INGEST_USD` (cap for the one LLM call that extracts a position's must-haves), `INTAKE_PER_HOUR_CAP`, `INTAKE_FORWARD_TO` (verified Email Routing destination for a human copy, may be empty), `INTAKE_FROM_ALLOW` (sender domains or addresses allowed to start runs by email, empty = any). Secrets: `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, `RUN_TOKEN` (bearer for machine clients: POST /api/runs stays bearer-only for the extension and scripts; the call routes, POST /api/runs/:id/delete, POST /api/runs/:id/translate (Czech brief, idea #24; one `verify`-model call per brief, cache `translations/<run>/brief-cs.json` in `SOURCES`, deleted with the run) and GET /api/roles accept a logged-in session or the bearer), `ELEVENLABS_API_KEY` and `ELEVENLABS_WEBHOOK_SECRET` (live calls only); optional `GITHUB_TOKEN`, `STACKEXCHANGE_KEY` and `OPENALEX_API_KEY` (added by `makeFetchJson` for api.github.com / api.stackexchange.com / api.openalex.org only); optional `BRAVE_SEARCH_KEY` (profile suggestions on the start form, plans/011; unset = the suggest route answers 503 and the form only takes a pasted URL); intake: `INTAKE_TOKEN` (bearer for `POST /api/intake/form`), `STARTUPJOBS_WEBHOOK_TOKEN` (path token of the StartupJobs webhook), optional `STARTUPJOBS_TOKEN`.
Worker entry `src/worker.ts` re-exports the OpenNext `fetch` and exports `ResearchRunWorkflow` and `VerificationCallWorkflow`. The Workflow imports only `src/domain/*` and `src/recipe/*`, never Next.js.
Recruiter auth: cookie sessions (`src/domain/session.ts`, D1 `sessions`), PBKDF2 passwords (`src/domain/password.ts`); the web UI never asks for RUN_TOKEN; the bearer stays for `POST /api/runs` (only) and as the machine-client alternative to a session on the call routes and `/api/roles`.

## Scripts (pnpm)
`dev`, `build`, `preview`, `deploy`, `cf-typegen`, `typecheck`, `lint`, `test`, `test:watch`, `db:migrate:local`, `db:migrate:remote`, `roles:sql`, `eval` (synthetic eval set, writes `eval/results.json` + `eval/RESULTS.md`; the same eval runs in `pnpm test` and fails on a new miss), `check` (= typecheck && lint && test, app and extension), `ext:build`. Do not rename.

## Directory map
- `src/domain/` pure: claim schemas today; `verify.ts` and `resolve.ts` are TODO (001 TDD steps 2–3). No I/O, ports are plain function parameters.
- `src/recipe/` per-goal questions and steps (`goals/*.ts`).
- `src/workflow/` Workflow class and runner adapters.
- `src/app/` Next.js routes and UI; `/runs/[id]` is the report page the extension opens.
- `extension/` WXT browser extension (Chrome, Edge, Firefox from one codebase; plans/004). Own `pnpm check`, included in the root one; `pnpm --filter oldboys-extension e2e` for the Playwright Chromium smoke.
- `migrations/` D1 SQL.
- `rules/` repo coding rules.
- `plans/` decision dossiers (001, 002).
- `specs/` unit contracts for a plan in flight (`specs/intake/` for 008); the code and tests are the source of truth once a unit lands.
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
- Agents deploy, migrate remote D1, touch Worker secrets, read `.dev.vars` or a single variable from `~/s`, or push only when Robert asks for it in the current task; never print or copy a secrets file.
- `pnpm exec wrangler deploy --dry-run --outdir <scratch>` is the allowed way to prove the Worker still bundles.
- Every user-visible change adds a line to `CHANGELOG.md` under Unreleased in the same commit.

## Known gotchas
- `migrations/0013_role_templates.sql` (role catalog) must be applied with `pnpm db:migrate:remote` before deploying this change; `migrations/0010_accounts.sql` before the accounts PR.
- `extension/` is a second pnpm workspace package; after pulling, run `pnpm install --frozen-lockfile` once or `pnpm check` fails with `wxt: command not found`.
- CI deploys on push to main but cannot migrate D1 (token has no D1 scope). A PR that adds a file under `migrations/` must say so; Robert runs `pnpm db:migrate:remote` before merging.
- `next` 16.4 runs on Workers only with `patches/@opennextjs__cloudflare@1.20.9.patch` (adds `preview-props.json` to the manifest glob, upstream PR #1356). Drop the patch when an OpenNext release includes it; bump `@opennextjs/cloudflare` and re-check `pnpm exec opennextjs-cloudflare build`.
- `typescript` stays on 6.x: typescript-eslint's peer range is `<6.1.0`, and `pnpm lint` (strictTypeChecked) is part of the gate.
- ESLint runs typescript-eslint `strictTypeChecked` + `stylisticTypeChecked` with no `warn` level; every finding fails `pnpm check`.
- `POST /api/runs` needs `Authorization: Bearer <RUN_TOKEN>`; the value lives in `~/s/oldboys/.env` and in the Worker secret.
- Without `GITHUB_TOKEN` the Worker gets HTTP 403 from api.github.com (anonymous limit shared by all Workers egress IPs); without `STACKEXCHANGE_KEY` Stack Exchange may answer 400 `throttle_violation`. OpenAlex needs a free `OPENALEX_API_KEY` (`api_key=` param) because the Worker's shared IP exhausts the anonymous daily budget (HTTP 429); Stack Exchange needs a Stack Apps key, otherwise 300 requests/day per IP. `fetchJson` puts the first 160 body characters in the ledger note.
- `github_deep` makes up to ~11 GitHub REST requests per handle; without `GITHUB_TOKEN` the shared anonymous 60/h limit is exhausted by one run.
