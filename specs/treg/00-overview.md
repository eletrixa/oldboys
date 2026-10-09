---
spec: treg-overview
status: draft
plan: 016
created: 2026-10-09
---
# Unit: treg second source and enrichment (overview)

Dossier: `plans/016-treg-enrichment/00-SYNTHESIS.md`. Runbook: `docs/ops/treg.md`. Per-collector specs in this folder refine this one.

## Purpose
- Second, independent read of the confirmed identity's social accounts (bio, counts, creation date) so a FACT about them is doubly sourced and contradictions surface through claim rank.
- Enrichment: other accounts from the confirmed LinkedIn profile (before the lineup), a LinkedIn people search for CV-only runs, a company record for due diligence.
- treg.to is one metered proxy over 60+ providers; children are called by catalog id, never a routed `treg.*` id.
- No model change, no new table, no new Apify run.

## Inputs
- `TREG_TOKEN` optional secret (`cloudflare-env.d.ts`, `.dev.vars.example`, CLAUDE.md); `missingSecrets` unchanged.
- `CollectorRequest` third kind: `{ via: "treg"; endpoint: string; method: "GET" | "POST"; params: Record<string, string | number | boolean | string[]>; maxCostUsd: number }`.
- `Ports.callTreg: TregCall | null` (null = secret unset or empty); `TregCall = (req: { endpoint; method; params; maxCostUsd }) => Promise<{ payload: unknown; cost_usd: number }>`.
- `StepContext` (`subject`, `anchor`, accepted candidates) as for every collector.

## Outputs
Steps per goal (all `kind: "actor"`, actor id `treg/*`):

| Goal | Pool | Step id | Actor | Gate |
|---|---|---|---|---|
| hiring | search, before `resolve_lineup` (after `facebook_search`) | `treg_person_enrich` | `treg/person-enrich` | a merged LinkedIn candidate |
| hiring | search, before `resolve_lineup` (before `github_search`) | `treg_people_search` | `treg/people-search` | non-empty subject and no merged LinkedIn candidate |
| hiring | collect, after `resolve_lineup` (after `facebook_page`, before `bluesky_profile`) | `treg_social_verify` | `treg/social-verify` (`enriches: true`) | at least one merged candidate with a reader |
| due-diligence | collect, after `resolve_lineup` (after `linkedin_company`) | `treg_company_enrich` | `treg/company-enrich` | anchor is an http(s) URL with a dotted host |
| due-diligence | collect, after `resolve_lineup` (after `instagram_profile`) | `treg_social_verify` | `treg/social-verify` | as hiring |

Endpoints and price (cap = `maxCostUsd`):

| Step | Endpoint | Method | Params | Price | Cap |
|---|---|---|---|---|---|
| `treg_person_enrich` | `apollo.people.enrich` | POST | `linkedin_url` (merged profile) | $0.026 | $0.03 |
| `treg_people_search` | `exa.people.search` | POST | `query` `<subject> <anchor>`, `category` "people", `numResults` 5, `includeDomains` ["linkedin.com"] | $0.007 | $0.01 |
| `treg_social_verify` linkedin | `fetchinio.linkedin.user.profile` | GET | `profileUrlOrUrn` | $0.0015 | $0.005 |
| `treg_social_verify` instagram | `tikhub.instagram.user.profile` | GET | `username` | $0.001 | $0.005 |
| `treg_social_verify` tiktok | `tikhub.tiktok.user.profile` | GET | `uniqueId` | $0.001 | $0.005 |
| `treg_social_verify` x | `anyapi.x.user.profile` | POST | `handle` | $0.00022 | $0.005 |
| `treg_social_verify` youtube | `scrapecreators.youtube.channel.profile` | GET | `handle` (or `channelId` for a `UC...` id) | $0.00188 | $0.005 |
| `treg_social_verify` facebook | `scrapecreators.x.v1-facebook-profile` | GET | `url`, `cache_max_age=7d` | $0.00188 | $0.005 |
| `treg_company_enrich` | `thecompaniesapi.companies.enrich` | GET | `domain` (anchor host, `www.` stripped) | $0.0019 | $0.005 |

- Step results: Sources with plain-sentence excerpts (numbers inline so FACTs can quote them); digests: `treg/person-enrich` accounts found, `treg/social-verify` `ProfileFacts[]` (merged accounts only, `source_url` = `https://treg.to/call/<endpoint>?<params>` with no token), `treg/company-enrich` `{ provider, domain, employees, founded, hq, socials }`.
- Expected treg spend per run about $0.04 to $0.06.

## Rules
Budget
- treg spend is USD-gated: the runner reserves each request's `maxCostUsd` against `ctx.budget.usd` before its chunk starts; a request that does not fit is dropped with the note "run budget reached".
- Real charge = `X-Treg-Cost-Micro / 1e6` (0 when the header is missing), added to the run cost and the step's ledger row `cost_usd`.
- `out.calls` is never incremented: `RUN_BUDGET_CALLS` counts Apify runs only. `isPaid` (`src/recipe/batch.ts`) is false for `treg/` actor ids, so a treg step never takes an Apify allowance slot and is never an Apify run.
- treg requests run in the parallel fetch chunks (up to 6 at a time), results applied in request order.
- Within `RUN_BUDGET_USD`; no separate treg budget.

Token
- `TREG_TOKEN` unset or empty: `ports.callTreg === null`; the runner pushes the note "TREG_TOKEN not set", sends no request, and the Workflow records the step as "not searched: TREG_TOKEN not set"; the rest of the run is unchanged.

Adapter (`src/adapters/treg.ts`, `makeTregCall(token)`)
- GET `https://treg.to/call/<endpoint>?<params>` (arrays joined with ","); POST the bare endpoint URL with the params as JSON body.
- Headers: `X-Treg-Token`, `X-Treg-Route-Max-Cost: <maxCostUsd>`, `accept: application/json`, `user-agent`; `content-type: application/json` on POST. 20 s timeout, no retry. The token is never put in a URL, note or Source.
- Empty 2xx body = `payload: null`.

Identity
- Enrichment hits are Sources whose excerpt carries the confirmed LinkedIn URL literally (`treg/person-enrich`), so the `resolve.ts` cross-link rule corroborates them; a provider's link alone never merges. Identity of every hit stays from `identityFor` ("unverified" unless already merged).
- `treg/social-verify` has `enriches: true`: the profile URL is stored again as a second Source for the same page.

Sensitive fields
- Every parse is an allow-list: only fields a collector names are read, the rest of the response is dropped.
- `reveal_*` flags are never sent.
- Dropped on purpose: Facebook `gender`, PDL `birth_*`, emails, phone numbers, addresses. No GDPR Art. 9 inference from any field. No score, no verdict word.
- Platform and handle in `treg/social-verify` come from the request params, never from the payload.

Collectors are pure (no fetch); each endpoint id and its params are constants inside its collector file.

## Failure modes
- 402 (balance exhausted) and 503 (provider capacity): adapter throws `treg <endpoint>: HTTP <status> <160-char snippet>`; the step shows "not searched: ... HTTP 402 insufficient_balance" in gaps; nothing charged; run continues.
- Timeout (20 s) or invalid JSON: recorded as a note, never as evidence.
- Malformed or "not found" payload: parse yields no source; step `onEmpty` gap applies (gap texts are fixed in `hiring.ts` and `due-diligence.ts`).
- Skip reasons: person-enrich "no confirmed LinkedIn profile to enrich"; people-search "no name to search" / "a LinkedIn profile is already confirmed (given profile)"; social-verify "no confirmed social account to read a second time"; company-enrich "the anchor is not the company's website (no domain to look up)".
- Budget too low for a request's cap: request dropped, note "run budget reached", no call.

## File map
- `src/adapters/treg.ts`: `tregUrl`, `makeTregCall(token)`; the only code that talks to treg.to.
- `src/domain/ports.ts`: `TregCall` type, `Ports.callTreg`.
- `src/recipe/sources/types.ts`: `CollectorRequest` `via: "treg"` variant.
- `src/recipe/runner.ts`: request-dispatch treg branch, TREG_TOKEN-unset filter, USD reservation, cost accounting.
- `src/recipe/batch.ts`: `isPaid` excludes `treg/`.
- `src/workflow/research-run.ts`: builds `callTreg` from `env.TREG_TOKEN`.
- `src/recipe/sources/index.ts`: registers the four collectors.
- `src/recipe/sources/treg/person-enrich.ts`: Apollo enrichment of the confirmed LinkedIn URL into other-account Sources.
- `src/recipe/sources/treg/people-search.ts`: Exa LinkedIn people search for CV-only runs.
- `src/recipe/sources/treg/company-enrich.ts`: The Companies API record of the anchor domain.
- `src/recipe/sources/treg/social-verify.ts`: second-read collector (requests, sentences, `ProfileFacts` digest).
- `src/recipe/sources/treg/social-account.ts`: `Account`, `Reader`, `TregParams`, request builders and zod shorthands.
- `src/recipe/sources/treg/social-readers.ts`: `READERS` with linkedin, instagram, tiktok readers.
- `src/recipe/sources/treg/social-readers-more.ts`: x, youtube, facebook readers (`MORE_READERS`).
- `src/recipe/goals/hiring.ts`, `src/recipe/goals/due-diligence.ts`: step placement and gap texts.
- `docs/ops/treg.md`: runbook; `CLAUDE.md` row "treg second source (016)".

Deviation in code: `social-readers.ts` and `social-readers-more.ts` hold per-platform tables, not collectors; the dossier names five pure collectors while the code has four collector objects plus a reader table (informational, no fix needed). (still open)
Deviation in code: the request dispatch throws "TREG_TOKEN not set" as a second guard besides the earlier filter; harmless, but only the filter's note is contractual. (still open)
Deviation in code: `docs/ops/treg.md` lists live-test `live-treg` as pending in the dossier; no `live-treg` test exists yet (waits for balance). (still open)

## Tests that prove it
- `src/adapters/__tests__/treg.test.ts`: GET url with params and array join, POST body, headers (token, max cost, accept), cost from `X-Treg-Cost-Micro` (missing = 0), empty body = null, non-2xx error text with 160-char snippet, token never in the URL.
- `src/recipe/__tests__/runner.test.ts` (`treg requests`): request performed via `callTreg`, cost added, `calls` not incremented, source stored; `callTreg === null` yields note "TREG_TOKEN not set" and no request; request over the remaining USD budget dropped with "run budget reached".
- `src/recipe/__tests__/batch.test.ts`: `isPaid("treg/...")` is false.
- `src/recipe/__tests__/goals.test.ts`: step ids and pool placement per goal as in the Outputs table (search-pool steps before `resolve_lineup`, `treg_social_verify` and `treg_company_enrich` after).
- `src/recipe/__tests__/treg-search.test.ts`: person-enrich and people-search requests, skip reasons, parse, literal LinkedIn URL in the excerpt, no emails or phones in `raw`.
- `src/recipe/__tests__/treg-social-verify.test.ts`: max 6 requests, dedupe, one reader per platform, excerpt numbers, digest only for merged accounts, `source_url` has no token, Facebook gender and other sensitive fields absent from excerpt, raw and facts.
- `src/recipe/__tests__/treg-company.test.ts`: domain extraction, empty object yields no source, excerpt sentence, digest.
- Not yet: `LIVE=1 TREG_TOKEN=... pnpm exec vitest run live-treg` (balance was $0.0001 on 2026-10-09).
