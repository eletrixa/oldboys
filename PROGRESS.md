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

## 2026-10-08 · fix: review 004
- fix3-logic: Instagram p/reel/reels/tv/stories/popular/explore get no handle, generic last-segment handle only on web (bsky.app/profile kept); `pickDrafts` requires first name + surname in title line or URL handle (folded, 1 edit, "L. Pokorný"), 4 drafts per profile platform; `isNoise` rejects Art. 9 and election titles (výsledky voleb, volby, kandidát).
- fix3-logic: identity questions quote the profile title, skip null handles; Brief `headline` (best merged profile title, 160 chars) shown as "Confirmed profile" next to "Hiring for" (RunState `role`); evidence deduped by excerpt and grouped by URL platform; calm degraded notice; tests in seams.test.ts and state.test.ts; pnpm check green.

## 2026-10-08 · fix: review 005
- fix4-logic: post-lineup collectors whose hits are all unconfirmed record gap "hits found, none confirmed (same name, identity not verified)" (`noneConfirmed` in resolve.ts, Workflow), listed under "Searched, nothing confirmed"; interview identity questions one per platform, none where a profile is merged; Facebook candidate adds not_searched "not collected: public Facebook pages need a login".
- fix4-logic: Brief `location_note` ("Confirmed profile mentions Jihomoravský, you entered Liberec", 20 largest Czech cities + regions, default null) under the Confirmed profile line; evidence dedupe strips trailing ".../…/Read more/See more/Více" and keeps the longer excerpt; tests in seams.test.ts and state.test.ts; pnpm check green.

## 2026-10-08 · interview-kit agent (Minas)
- Started: 22:52. Idea #6 "Interview kit export": "Copy interview kit" and "Download .md" under the brief's top line; pure `interviewKit` builds Markdown from RunState only (header with role, confirmed profile, date and research cost; coverage per question with sourced claims, or the degraded note + role criteria + evidence links; interview questions as a checklist with Notes; to verify; searched/not searched gaps; footer "rates the research, never the candidate"). Never `also_found`; model text Markdown-escaped, links only for http(s). File name `interview-kit-<run id prefix>.md`.
- Finished: 23:00. GAP_LABEL, gapLine and searchedEmpty moved from parts.tsx to state.ts. No schema change, no new endpoint; pnpm check green, wrangler dry-run bundles.
- Files: src/app/runs/[id]/{interview-kit.ts,kit-actions.tsx,__tests__/interview-kit.test.ts} (new), src/app/runs/[id]/{parts.tsx,state.ts}, PROGRESS.md.

## 2026-10-08 · candidate-copy agent (Minas)
- Started: 23:08. Idea #7 "Candidate copy of the report" (GDPR: the candidate is informed): "Copy candidate notice" and "Download candidate notice (.md)" next to the interview kit buttons; pure `candidateCopy` builds a polite Markdown notice from RunState only (role, why, public sources searched / searched with nothing confirmed / not searched with reasons, links confirmed as theirs from merged candidates and confirmed evidence, "rates the evidence, never you", deletion date = created_at + 7 days or on rejection, "Reply to this email" for correction/deletion). Never claims, summaries, interview questions, to-verify, cost, excerpts, headline/location note or `also_found`; text Markdown-escaped, links only for http(s). File name `candidate-notice-<run id prefix>.md`; null without a brief.
- Finished: 23:16. Copy/download helpers in kit-actions.tsx shared by both documents. No schema change, no new endpoint; pnpm check green.
- Files: src/app/runs/[id]/{candidate-copy.ts,__tests__/candidate-copy.test.ts} (new), src/app/runs/[id]/kit-actions.tsx, PROGRESS.md.

## 2026-10-08 · summary-30s agent (Minas)
- Started: 23:10. Idea #15 "30-second summary": "In 30 seconds" card above the brief's top line. Pure `summary30s` from RunState, no model call: (1) confirmed platforms (merged candidates + brief.evidence) and "N of M role criteria have evidence" (degraded or all-unavailable: "role criteria were not checked because AI was off"), (2) at most two gaps (criteria with no evidence, then searched-empty, then not searched), (3) first interview question or to-verify item, shortened to 90 chars. "Read aloud" via browser SpeechSynthesis, hidden when unsupported.
- Finished: 23:16. Never `also_found` or unconfirmed candidates, no verdict words; parts.tsx got one import + one JSX line only. No schema change, no new endpoint; pnpm check green.
- Files: src/app/runs/[id]/{summary.ts,summary-card.tsx,__tests__/summary.test.ts} (new), src/app/runs/[id]/parts.tsx, PROGRESS.md.

## 2026-10-08 · role-overview agent (Minas)
- Started: 23:05. Idea #16 "Overview of candidates for one role": /roles lists roles (role text trimmed, whitespace collapsed, case-insensitive) with brief counts; /roles/<key> shows runs newest first × role must-haves (mh-, union across runs matched by text) with labels documented / partial / no evidence / not checked (brief missing, degraded, or question not asked) and "Sources confirmed" (identity merged only; also_found never shown). Visible line "This table shows how much public evidence the research found, not how good a candidate is."; no total, no ranking, no coverage sort.
- Auth: GET /api/roles requires `Authorization: Bearer <RUN_TOKEN>` (a list enumerates every run, so the UUID-only rule of GET /api/runs/:id does not hold); the page asks for the team token once and keeps it in sessionStorage.
- Finished: 23:20. Pure `roleOverview` + `roleKey`; one small "Roles" link on the start page. No schema change; pnpm check green.
- Files: src/domain/role-overview.ts, src/domain/__tests__/role-overview.test.ts, src/app/api/roles/route.ts, src/app/roles/{page.tsx,roles-view.tsx,[key]/page.tsx} (new), src/app/page.tsx, PROGRESS.md.

## 2026-10-08 · audit-record agent (Minas)
- Started: idea #17 "GDPR audit record": one page per run at /runs/:id/audit plus GET /api/runs/:id/audit (same open access as /state, `?download=1` sets the file name).
- Finished: pure `auditRecord` builds start channel (form = via start, extension = api + source_url, api), legal basis line (Art. 6(1)(f), candidate informed) + purpose (role), every collector step with status ok / empty / failed / not searched + reason, items (ref.sources), time and cost, model calls (runCost), last lineup answer as yes / no / not sure (platform + title only), call status with MOCK flag, deletion date = created_at + 7 days + "deleted earlier on rejection". `RETENTION_DAYS` moved to src/domain/audit.ts and imported by purge.ts. "Download audit record (.json)" button; small "Audit record" link under the run view. No schema change; pnpm check and next build green.
- Files: src/domain/audit.ts, src/domain/__tests__/audit.test.ts (12 tests), src/app/api/runs/[id]/audit/{route,load}.ts, src/app/runs/[id]/audit/page.tsx (new); src/app/runs/[id]/page.tsx, src/workflow/purge.ts, PROGRESS.md.

## 2026-10-08 · identity-map agent (Minas)
- Started: 23:32. Idea #9 "Identity map": SVG card above "Profiles we found" with the subject's first name in the center, profiles we link to them on a ring (solid teal = This is them, thicker when the user supplied the link; dashed amber = Not sure yet) and namesakes in a grey "Someone else" column with no line; ✓ ? × marks inside the nodes, platform + @handle labels, tooltip = snippet · first reason, links only for http(s), caps 10 / 6 with "+N more", ring grows and drops the @handle line above 6 nodes. Same `decisionOf` as the profile list, so lineup answers move nodes live; no score or rating; legend + "Lines show which profiles we link to {first}, not how good a candidate is."
- Finished: 23:37. Pure `identityMapLayout` + `IdentityMapCard` above the profile list (shown from 2 candidates); run-view.tsx got one import + one JSX line. No schema change, no new endpoint; pnpm check green, wrangler dry-run bundles.
- Files: src/app/runs/[id]/{identity-map.ts,identity-map-card.tsx,__tests__/identity-map.test.ts} (new), src/app/runs/[id]/run-view.tsx, PROGRESS.md.

## 2026-10-08 · audit-privacy agent (Minas)
- Started: 23:45. Follow-up to idea #17: honest legal basis (no "candidate informed" claim, new "Candidate notice: not recorded" line), free-text reasons scrubbed (URLs → host, e-mails, phone numbers), lineup titles kept only for confirmed profiles; same scrub for "not searched" reasons in the candidate notice.
- Finished: 23:49. Pure `scrubReason` (src/domain/scrub.ts). No schema change, no new endpoint; pnpm check green.
- Files: src/domain/{scrub.ts,__tests__/scrub.test.ts} (new), src/domain/audit.ts, src/domain/__tests__/audit.test.ts, src/app/runs/[id]/audit/page.tsx, src/app/runs/[id]/candidate-copy.ts, src/app/runs/[id]/__tests__/candidate-copy.test.ts, PROGRESS.md.

## 2026-10-08 23:55 · Radar UI (Josef's Claude session)
- Started/finished: Radar brand theme (design kit V2 + visual guideline) over the whole UI without rewriting components: `globals.css` defines semantic tokens (canvas, surface, ink, muted, action, sage, peach, divider, focus, ok/unsure/conflict) and remaps the zinc/teal/amber/red/emerald/violet scales the existing classes use, so the dark theme renders as Radar's warm light theme. New code should use the semantic names (bg-canvas, text-ink, bg-action, text-muted, border-divider, bg-ok-bg text-ok).
- Shell and home: Echo r mark + "radar" wordmark, Roles / New brief, honesty footer (`layout.tsx`); editorial home with three steps and the start form in a card (`page.tsx`). Supported states (evidenced, This is them, strong, audit ok, identity-map merge) now use the green `ok` tokens instead of rust.
- Fonts: Public Sans and Newsreader variable TTFs self-hosted in `public/fonts` with their OFL notices (no network fetch).
- Not touched: start-form logic, run-view logic, API, extension UI. `pnpm check` and `pnpm build` green.
