# Unit: treg company enrichment (`treg/company-enrich`, due diligence)

Plan: `plans/016-treg-enrichment/00-SYNTHESIS.md`. Step id `treg_company_enrich` in `src/recipe/goals/due-diligence.ts`.

## Purpose
- Give a due-diligence brief a second, independent read of the company behind the anchor website: one Source with name, legal name, industry, employee count, founding year and HQ in plain sentences a FACT can quote, plus a digest for the state route.
- Pure collector: no fetch, no model; the runner executes the request through `Ports.callTreg`.

## Files
- `src/recipe/sources/treg/company-enrich.ts` (`tregCompanyEnrich: Collector`, id `treg/company-enrich`)
- `src/recipe/__tests__/treg-company.test.ts`
- Registered in the due-diligence recipe only: `{ id: "treg_company_enrich", kind: "actor", actor: "treg/company-enrich", onEmpty: { gap: "no company record for the anchor domain (The Companies API via treg)" } }`

## Inputs
- `StepContext.anchor`: the due-diligence anchor URL.
- Domain = `new URL(anchor).hostname` with a leading `www.` removed. Valid only for `http:` / `https:` and a host containing a dot.
- Anchor that is not such a URL (a place such as "Brno", other scheme, dotless host) → `requests` returns `[]`.
- Skip reason (exact): `the anchor is not the company's website (no domain to look up)`.
- Payload from the adapter: `unknown`.

## Outputs
- Request (exactly one): `{ via: "treg", endpoint: "thecompaniesapi.companies.enrich", method: "GET", params: { domain }, maxCostUsd: 0.005 }`. Provider cost about $0.0019.
- Parse allow-list (anything else is dropped, never stored in `raw`): `about.name`, `about.nameLegal`, `about.industry`, `about.industries[0]`, `about.totalEmployees`, `about.totalEmployeesExact`, `about.yearFounded`, `locations.headquarters.city.name`, `locations.headquarters.country.name`, `socials.*.url` (http(s) only), `domain.domain`.
- Source (exactly one): `url = https://<domain>/` (the company website), `excerpt` = plain sentence, `raw` = the allow-listed record, `identity = identityFor(ctx, url)`.
- Excerpt: `<name>[ (legal name <legal>)] is a <industry, "-" as space> company[, founded in <year>][, with <about N employees | range employees>][, headquartered in <city, country>]. Read by The Companies API via treg.` (industry absent → "a company"; legal name shown only when different from name; exact count wins over range). Passed through `clip`.
- Digest (first fetched payload that parses): `{ provider: "thecompaniesapi", domain, employees, founded, hq, socials }` where `employees` / `founded` are number or null, `hq` is "City, Country" or null, `socials` is an array of profile URLs. No parsable payload → `null`.
- Empty object, `null`, a string, or a payload without a string `about.name` → no Source, digest `null`; the step's `onEmpty` gap is recorded by the runner.

## Rules
- Budget: runner reserves `maxCostUsd` (0.005) against `ctx.budget.usd`; `out.calls` is not incremented; `isPaid` stays false for `treg/` ids.
- `ports.callTreg === null` → the runner records "not searched: TREG_TOKEN not set"; this collector is not called.
- Sensitive or irrelevant datapoints (email patterns, technologies, financials, 80+ other fields) are never read.
- Excerpt carries only facts the provider returned; no inference, no score, no verdict words.
- Identity: the anchor site is not a candidate profile, so `identityFor` usually yields "unverified"; no merge decision is made here.

## Failure modes
- Provider 402 / 503 / timeout → adapter throws `treg <endpoint>: HTTP <status> ...`; runner turns it into a ledger note, step output empty, `onEmpty` gap applies.
- Provider answers `{}` for an unknown domain → no Source, gap.
- Provider returns `domain.domain` different from the anchor host → see deviation below.
- Malformed field types (e.g. `about.name: 5`) → whole payload rejected, no Source.

## Tests that prove it (`treg-company.test.ts`)
- Request: `https://www.stripe.com/en-cz` → params `{ domain: "stripe.com" }`, endpoint, method GET, `maxCostUsd 0.005`.
- Place anchor ("Brno") → `[]` and the exact skip reason.
- Excerpt equals the exact sentence for the Stripe fixture; url `https://stripe.com/`; `raw` lacks `emailPatterns`.
- `{}`, `null`, `"nope"`, `{ about: { name: 5 } }` → `[]`.
- Digest equals `{ provider, domain, employees: 8000, founded: 2010, hq, socials: [twitter, github] }` (non-URL social entries dropped); `{}` payload → `null`.


- Fallbacks (documented in the code header, covered by tests): range string `totalEmployees` when `totalEmployeesExact` is missing, `industries[0]` when `industry` is missing.
