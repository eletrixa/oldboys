# treg second source (plan 016)

treg.to is one metered proxy over 60+ data providers. Here it does two jobs: a second, independent read of the confirmed identity's social accounts (a FACT about a bio or a follower count is then doubly sourced), and enrichment (other accounts found from the confirmed LinkedIn profile, a LinkedIn people search for CV-only runs, a company record for due diligence). Dossier: `plans/016-treg-enrichment/00-SYNTHESIS.md`.

## Secret
`TREG_TOKEN` is optional: the per-org token from `treg login`.
- Prod: `pnpm exec wrangler secret put TREG_TOKEN` (only when Robert asks).
- Local: `TREG_TOKEN=` in `.dev.vars`.
- Unset: every `treg/*` step is recorded as "not searched: TREG_TOKEN not set", nothing is called, the rest of the run is unchanged.

## Balance
- `treg balance` shows the team balance. Top up under Team, Billing: https://treg.to/app#billing.
- An empty balance answers HTTP 402. The step shows "not searched: ... HTTP 402 insufficient_balance" in the run's gaps and nothing is charged. A 503 is provider capacity, also not charged.

## Cost per run
The runner reserves each request's `maxCostUsd` against `RUN_BUDGET_USD`; treg calls never count against `RUN_BUDGET_CALLS` (Apify runs only). Expected spend is about $0.04 to $0.06 per run.

| Step | Endpoint | Price | Cap |
|---|---|---|---|
| `treg_person_enrich` | `apollo.people.enrich` (POST, merged LinkedIn URL) | $0.026 | $0.03 |
| `treg_people_search` | `exa.people.search` (CV-only runs) | $0.007 | $0.01 |
| `treg_social_verify` LinkedIn | `fetchinio.linkedin.user.profile` | $0.0015 | $0.005 |
| `treg_social_verify` Instagram | `tikhub.instagram.user.profile` | $0.001 | $0.005 |
| `treg_social_verify` TikTok | `tikhub.tiktok.user.profile` | $0.001 | $0.005 |
| `treg_social_verify` X | `anyapi.x.user.profile` (POST) | $0.00022 | $0.005 |
| `treg_social_verify` YouTube | `scrapecreators.youtube.channel.profile` | $0.00188 | $0.005 |
| `treg_social_verify` Facebook | `scrapecreators.x.v1-facebook-profile` | $0.00188 | $0.005 |
| `treg_company_enrich` (due diligence) | `thecompaniesapi.companies.enrich` (GET `domain`) | $0.0019, free when not found | $0.005 |

## Where spend is recorded
- Each step's ledger row carries `cost_usd` (the `X-Treg-Cost-Micro` header of the response).
- Audit trail on treg's side: `treg calls`.
- No LLM is involved, so nothing goes to `docs/ops/llm-manual-runs.md`.

## Switching a provider
Each collector in `src/recipe/sources/treg/` holds its endpoint id and params as constants. `treg catalog get <endpoint-id>` lists same-job alternatives with price and hit rate. Change the constant and the parse allow-list together, and update the table above. Always call a child by its catalog id, never a routed `treg.*` id (the shape changes per provider and misses are billed).

## Sensitive fields
Parsing is an allow-list: only the fields a collector names are read, the rest of the response is dropped. `reveal_*` flags are never sent. Dropped on purpose: Facebook `gender`, PDL `birth_*`, emails and phone numbers. No GDPR Art. 9 inference from any field.
