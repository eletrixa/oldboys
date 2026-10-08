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
