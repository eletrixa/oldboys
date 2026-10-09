# 016 — treg as a second source: synthesis (2026-10-09)

## Why
Every social profile in a brief today comes from one Apify actor. A second, independent read of the same public
account (bio, counts, creation date) makes a FACT about it doubly sourced and surfaces contradictions through the
existing claim rank; a people-enrichment provider finds the candidate's other accounts from the confirmed LinkedIn
profile before the identity lineup, where today only Google indexing and on-platform name search do. treg.to is one
metered proxy over 60+ providers (catalog research: `research/*.md` in the session scratchpad, summarised below).

## Decision
A third request kind in the collector contract, one adapter, four pure collectors (`social-verify` reads per-platform tables), no model change, no new table.

| Topic | Decision |
|---|---|
| Request | `{ via: "treg"; endpoint: string; method: "GET" \| "POST"; params: Record<string, string \| number \| boolean \| string[]>; maxCostUsd: number }` in `CollectorRequest` |
| Port | `TregCall = (req: { endpoint; method; params; maxCostUsd }) => Promise<{ payload: unknown; cost_usd: number }>`; `Ports.callTreg: TregCall \| null` (null = secret unset) |
| Adapter | `src/adapters/treg.ts` `makeTregCall(token)`: GET `https://treg.to/call/<endpoint>?<params>` or POST JSON body; headers `X-Treg-Token`, `X-Treg-Route-Max-Cost: <maxCostUsd>`, `accept: application/json`, UA; 20 s timeout; `cost_usd = X-Treg-Cost-Micro / 1e6` (0 when the header is missing); non-2xx throws `treg <endpoint>: HTTP <status> <160-char snippet>` (402 = balance exhausted, 503 = provider capacity, nothing charged); empty body = null |
| Runner | treg requests run in the parallel fetch chunks, USD-gated by reserving `maxCostUsd` per request against `ctx.budget.usd`; `out.calls` is not incremented (RUN_BUDGET_CALLS counts Apify runs only); `ports.callTreg === null` → note `TREG_TOKEN not set`, no request, so the Workflow records "not searched: TREG_TOKEN not set" |
| Pools | `isPaid` (`src/recipe/batch.ts`) stays false for `treg/` actor ids: treg steps never take an Apify allowance slot |
| Secret | `TREG_TOKEN` optional (`cloudflare-env.d.ts`, `.dev.vars.example`, CLAUDE.md); `missingSecrets` unchanged |
| Budget | within `RUN_BUDGET_USD`; expected treg spend per run ≈ $0.04–0.06 |
| Identity | enrichment hits are Sources whose excerpt carries the confirmed LinkedIn URL literally, so the existing cross-link rule in `resolve.ts` corroborates them; a provider's link alone never merges (the LLM score + corroboration decide as for any hit) |
| Facts | `treg/social-verify` has `enriches: true` (stores the profile URL again as a second Source for the same page) and writes `ProfileFacts[]` as its digest with `source_url` = the treg endpoint URL without the token |
| Sensitive fields | never requested (`reveal_*` flags off) and dropped at parse: Facebook `gender`, PDL `birth_*`; parse is an allow-list |

## Steps (hiring)
Before the lineup (search pool):
- `treg_person_enrich` → `treg/person-enrich`: `apollo.people.enrich` (POST, `linkedin_url` only) with the merged LinkedIn URL ($0.026, 100 % WORKS on 121k). Emits one Source per `twitter_url` / `github_url` / `facebook_url` (canonical profile URL; excerpt line 1 `<Name> – <headline>`, then "Linked from the confirmed LinkedIn profile <url> by Apollo people enrichment via treg", employer and title lines). `maxCostUsd 0.03`. Skip reason: "no confirmed LinkedIn profile to enrich".
- `treg_people_search` → `treg/people-search`: only when no LinkedIn candidate is merged (CV-only run): `exa.people.search` ($0.007) `{query: "<subject> <anchor>", category: "people", numResults: 5, includeDomains: ["linkedin.com"]}`. One Source per matching LinkedIn profile (result name spells the full subject name; line 1 `<name> – <title> @ <company>`, location, work history lines). `maxCostUsd 0.01`. Skip reason: "a LinkedIn profile is already confirmed (given profile)".

After the lineup (collect pool):
- `treg_social_verify` → `treg/social-verify` (`enriches: true`): one profile read per merged candidate, max 6 requests:
  linkedin `fetchinio.linkedin.user.profile` GET `profileUrlOrUrn` ($0.0015); instagram `tikhub.instagram.user.profile` GET `username` ($0.001); tiktok `tikhub.tiktok.user.profile` GET `uniqueId` ($0.001); x `anyapi.x.user.profile` POST `handle` ($0.00022); youtube `scrapecreators.youtube.channel.profile` GET `handle` ($0.00188); facebook `scrapecreators.x.v1-facebook-profile` GET `url`, `cache_max_age=7d` ($0.00188). `maxCostUsd 0.005` each. Excerpt: plain sentences with the numbers ("The Instagram account @x has 1 234 followers, follows 56 accounts and has 78 posts; bio: …; read by TikHub via treg (second source)"; the read date is the Source's `fetched_at`, collectors are pure). Digest: `ProfileFacts[]` for merged accounts.

Due diligence (both after `resolve_lineup`, collect pool):
- `treg_company_enrich` → `treg/company-enrich`: `thecompaniesapi.companies.enrich` GET by `domain` (anchor URL's host, $0.0019; 99 % HIT on 447k). One Source (URL = `https://<anchor host>/`, the provider's own `domain.domain` only in the digest) with name, legal name, industry, employee count, founding year, HQ; `maxCostUsd 0.005`.
- `treg_social_verify` as in hiring.

## Not chosen
- Routed `treg.*` endpoints: provider-native shapes change per call, misses billed; children are called by id.
- Replacing the Apify SERP by Serper ($0.001/query): a plan 013 phase 2 item, separate change.
- Bluesky / Reddit / Threads via treg: Bluesky's public API is free and already used; Reddit and Threads handles are never found today; revisit when a handle source exists.
- A comparison card ("Apify says 1 200, TikHub says 1 234"): the verify seam already ranks contradicting claims; the trust box counts sources by origin.

## Verification
`pnpm check`; `LIVE=1 TREG_TOKEN=… pnpm exec vitest run live-treg` (to add once the balance is topped up: the team balance was $0.0001 on 2026-10-09, every live probe answers 402).
