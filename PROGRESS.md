# PROGRESS

Each agent appends: what it starts, progress, what it finishes. Newest at the bottom. Read others' entries before touching shared files.

## 2026-10-08 20:30 · lead (Robert's Claude session)
- Started: Phase A on top of the Cloudflare scaffold (plans/002) and plans/003 domain changes.
- Added: migration 0002 (role, questions_json, candidate platform/handle/snippet/reasons, briefs), Brief schema, Ports (fetchJson, now, newId; ActorCall/LlmCall return cost), Step.query, collector contract `src/recipe/sources/types.ts`, registry, google-search + ARES collectors, pure runner `src/recipe/runner.ts`, seams resolve/extract/verify/synthesize, adapters apify (REST run-sync)/fetch/llm/d1+r2.
- Next: tests green, wire Workflow to runner, collectors for the remaining sources, Screen 1 + 2 UI.

## 2026-10-08 · makers collector agent
- Started: five REST collectors (github, stackexchange, huggingface, orcid, openalex); index.ts untouched.
- Files: src/recipe/sources/{github,stackexchange,huggingface,orcid,openalex}.ts, src/recipe/__tests__/sources-makers.test.ts (16 tests).
- Status: `pnpm check` green (66 tests total). Lead must register the five in index.ts and pick a StepKind for them.

## 2026-10-08 · audience collectors agent
- Started: instagram, x, tiktok, youtube, bluesky collectors in src/recipe/sources/ plus __tests__/sources-audience.test.ts.
- Finished: pnpm check green; not registered in index.ts (lead does that).

## 2026-10-08 · role-seam agent
- Started: src/recipe/seams/role.ts (roleQuestions + profileFor) and src/recipe/__tests__/role.test.ts.
- Finished: LLM must-have questions with mh- ids, deterministic fallback, ordered profileFor rules; tests added.

## 2026-10-08 · col-web
- Started/finished: collectors linkedin.ts (harvestapi profile + apimaestro fallback), linkedin-company.ts (harvestapi/linkedin-company; apify/linkedin-company-scraper 404s), website.ts, text.ts helper, __tests__/sources-web.test.ts.
- Not wired: lead must register `linkedinProfile`, `linkedinProfileDetail`, `linkedinCompany`, `websiteCrawler` in sources/index.ts and use the new actor ids in recipes.

## 2026-10-08 · ui agent
- Started: Screen 1 (src/app/start-form.tsx) and Screen 2 (src/app/runs/[id]/) plus GET /api/runs/[id]/state stub.
- Finished: pnpm check and pnpm build run; see report for contract questions (role not stored, token is public).

## 2026-10-08 · run-cost agent (Minas)
- Started: idea #25 "Cena a čas u každého reportu": cost and research time on the run page from the ledger.
- Finished: pure `runCost` + `formatDuration` (pause time excluded, open pause stops the clock), `cost` field on RunState filled by GET /api/runs/:id/state, muted `CostLine` under the run header; stale verify TODO removed from claim.ts header. No schema change, no new endpoint.
- Files: src/domain/run-cost.ts, src/domain/__tests__/run-cost.test.ts, src/app/api/runs/[id]/state/route.ts, src/app/runs/[id]/{state.ts,parts.tsx,run-view.tsx}, src/domain/claim.ts.

## fix: review 001 (screen 2 UX, fixes 6-8)
- Screen 2: questions ask profile platforms only (web fills up to 3), platform marks + match reason, failed row marked with plain-words reason and Try again, honest progress copy and bar (step_index/step_count/failed_step in state), answer errors retried, degraded brief notice; start page footer removed.
- Files: src/app/runs/[id]/{run-view,parts,state}.ts(x), src/app/api/runs/[id]/state/route.ts, src/app/page.tsx. Lead wires: Brief `degraded`/`evidence` fields (read defensively), `identity` type errors from others block full pnpm check.

## 2026-10-08 · fix: review 001
- Fixes 1, 2, 4: extract/synthesize degrade instead of failing (evidence-only Brief with `degraded` + `evidence`, run ends `done`); resolve fallback never merges on text (anchor 0.6, name 0.5, merge only on anchor URL or cross-link), drops PDF/genealogy noise, dedupes by host+path.
- Collectors that made no request record "not searched: <why>" gaps (budget or no confirmed handle), listed first in `not_searched`; pnpm check green.
- Fix 3: `Source.identity` (merged | unverified, migration 0005, applied locally); every collector sets it via `identityFor` (url under a merged candidate profile url or handle segment), serp always unverified, ARES merged only for the IČO anchor, YouTube videos merged when the scraped channel is a merged candidate.
- Name-search hits (github/stackexchange/orcid/openalex/huggingface/bluesky/youtube search, website crawl of excerpt links) stay unverified; tests in src/recipe/__tests__/sources-identity.test.ts; pnpm check green.

## 2026-10-08 · fix: review 002
- fix-screen2: degraded brief (one notice, compact criteria card, confirmed vs unconfirmed evidence with show-more), skipped progress rows, ref.calls-based AI call count, searched_empty/not_searched lists with labels, plain match reasons, CACHED badge (src/app/runs/[id]/{parts,run-view,state}.ts*, src/domain/run-cost.ts, state route).
- fix-screen2: wire: Brief.searched_empty is read via an in-guard (works before/after the type has it); RunState gained created_at; CostRow gained optional ref_json.
- fix-identity: SERP hits no longer count as confirmed (extract/synthesize trust identity "merged" only; `applySourceIdentity` re-marks sources by `profileKey` after the lineup and before extract); rejected profiles excluded by profile key; resolve ranks platforms and dedupes before the 12-draft cap (web max 6); plain match reasons; Brief `searched_empty` split from `not_searched` (prefix stripped); degraded interview questions templated (open profiles, second-person questions, cap 6).
- fix-identity: parallel collector batches start at most (budget - spent) paid actor steps (`planBatch`, src/recipe/batch.ts); files: src/recipe/seams/{resolve,extract,synthesize}.ts, src/recipe/batch.ts, src/adapters/d1.ts, src/workflow/research-run.ts, src/domain/claim.ts; tests in seams.test.ts, batch.test.ts, claim.test.ts; pnpm check green.

## 2026-10-08 · fix: review 003
- fix2-logic: AI call count true (seams report successful model calls; role_questions and resolve ledger rows carry `calls`; run-cost counts a missing `calls` as 0, keyless run = 0); directory/listing pages never candidates (`isNoise`: LinkedIn non-/in//posts//company, Facebook /public/, "profilů/profiles/People named/Results" titles); Facebook and YouTube canonicalised (no "watch" handle, facebook host variants dedupe).
- fix2-logic: role criteria card shows mh- questions only ("No role criteria yet"); fallback location = role's place or anchor city ("Prague"); degraded interview questions = ≤2 social identity checks + role must-haves in second person; lineup asks one profile per platform; talks gap "no talks, podcasts or posts found in web search"; tests in seams/role/run-cost/state tests; pnpm check green.
