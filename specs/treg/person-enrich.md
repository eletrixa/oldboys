# Unit: treg/person-enrich (Apollo people enrichment via treg, plan 016)

## Purpose
- Before the identity lineup, find the candidate's other public accounts (x, github, facebook) from the confirmed LinkedIn profile, so the lineup has hits that cross-link to a merged profile.
- Dossier: `plans/016-treg-enrichment/00-SYNTHESIS.md` (step `treg_person_enrich`, hiring search pool). Code: `src/recipe/sources/treg/person-enrich.ts` (`tregPersonEnrich: Collector`, `normaliseSocialUrl`). Tests: `src/recipe/__tests__/treg-search.test.ts`.
- Pure collector: no fetch; the runner executes the `via: "treg"` request through `Ports.callTreg`.

## Inputs
- `StepContext` (`ctx`): `candidates`, `subject`.
- Precondition: a candidate with `decision === "merge"` (`acceptedCandidates`), `platform === "linkedin"` and a `profile_urls` entry matching `/linkedin\.com\/in\//i`. The first such URL is the confirmed LinkedIn URL, used verbatim (no normalisation, trailing slash kept).
- `possibly-same-as` / `ask` / rejected LinkedIn candidates and non-LinkedIn merged candidates do not qualify.
- Payload (parse, digest): provider response of `apollo.people.enrich`, `{ person?: Person | null }`.

## Outputs
### requests(ctx)
- No confirmed LinkedIn URL: `[]`.
- Otherwise exactly one request, nothing else:
  `{ via: "treg", endpoint: "apollo.people.enrich", method: "POST", params: { linkedin_url: <confirmed URL> }, maxCostUsd: 0.03 }`.
- `params` never contains a `reveal_*` key (no personal email, phone or similar reveal); expected cost $0.026.

### skipReason()
- `"no confirmed LinkedIn profile to enrich"` (the Workflow records it as "not searched").

### parse(payload, ctx)
- Allow-listed `Person` fields only (Zod, every field `nullish`): `name`, `first_name`, `last_name`, `headline`, `title`, `linkedin_url`, `twitter_url`, `github_url`, `facebook_url`, `photo_url`, `city`, `country`, `organization.name`, `employment_history[].{title, organization_name, start_date, end_date}`. Anything else (emails, phones, `personal_*`, demographics, nested org phones, history emails) is dropped by the parse and never reaches `raw`.
- Returns `[]` when the payload is not `{ person: object }`, `person` is null/missing, a field has the wrong type, the confirmed LinkedIn URL is missing, or no social URL survives normalisation.
- One `ParsedSource` per distinct normalised URL from `twitter_url`, `github_url`, `facebook_url` (in that order, deduplicated):
  - `url`: `normaliseSocialUrl(value)`.
  - `raw`: the allow-listed person record.
  - `identity`: `identityFor(ctx, url)`; in practice `"unverified"` (a provider's link alone never merges).
  - `excerpt` (`clip`ped, lines joined with `\n`, empty lines omitted):
    1. `<Name> – <headline>`; Name = `name`, else `first_name last_name`, else `ctx.subject.trim()`; headline = `headline`, else `<title> @ <org>`, else `<title>`; no headline: the name alone.
    2. Literally `Linked from the confirmed LinkedIn profile <confirmed URL> by Apollo people enrichment via treg` (the confirmed URL appears verbatim so `corroboration()` in `src/recipe/seams/resolve.ts` finds the cross-link by substring and `namesSubject` finds the name in line 1).
    3. `Current: <title> at <org>` (`Current: <title>` without org; omitted without title).
    4. `Location: <city>, <country>` (non-empty parts only; omitted when none).
    5. Up to 5 history lines `<title> @ <org> (<start>–<end or "now">)`, only for entries with a title or organisation.
- Same excerpt on every Source of the payload.

### normaliseSocialUrl(raw)
- Trimmed; not a parseable absolute URL: `null`; empty path: `null`.
- Host lower-cased, leading `www.` stripped for twitter/x.
- `twitter.com` and `x.com` (with or without `www.`): `https://x.com/<first path segment>`.
- Other hosts: `https://<host>/<path segments>`; scheme forced to https, no query, no fragment, no trailing slash.
- Deviation in code: other hosts keep `www.` (`www.github.com` stays `https://www.github.com/...`) and keep every path segment (`github.com/janad/repo` is not reduced to the profile `github.com/janad`); the dossier says "canonical profile URL".

### digest(fetched, ctx)
- First fetched payload with a person and at least one social URL wins; otherwise `null` (also for `[]`).
- Shape: `{ provider: "apollo", linkedin_url: <confirmed URL | null>, found: { platform: platformOf(url), url }[], employer: <organization.name | null>, title: <title | null> }`. Written by the runner into the step ledger ref `digest`.
- Dossier gap: the dossier does not define the digest; this shape is the code's and is the contract from here.

## Rules
- Identity stays `"unverified"`: LLM score plus `corroboration()` decide the merge; a rule that merged on the provider's link alone is a defect.
- Allow-list parse; sensitive fields (Facebook `gender`, PDL `birth_*`, contact data) are never requested and never stored.
- Runs in the hiring search pool (before `resolve_lineup`) with `onEmpty` gap "people enrichment (Apollo via treg) listed no other public account for the confirmed LinkedIn profile".
- Runner side (not this unit): reserves `maxCostUsd` against `ctx.budget.usd`, does not increment `out.calls`, `isPaid` false for `treg/` ids; `Ports.callTreg === null` gives note `TREG_TOKEN not set` and no request.

## Failure modes
- Malformed or empty payload, `person: null`, wrong types: `parse` `[]`, `digest` `null`; no throw.
- No merged LinkedIn candidate: no request, skip reason above.
- Provider HTTP error (402 balance, 503 capacity, other non-2xx) is thrown by the adapter (`treg <endpoint>: HTTP <status> <snippet>`) and handled by the runner, not here.
- Apollo lists only a LinkedIn URL or only unparsable URLs: `[]` (gap via `onEmpty`).

## Tests that prove it (`treg-search.test.ts`, describe `tregPersonEnrich`)
- requests: one capped POST with `linkedin_url` and `maxCostUsd 0.03`; `[]` with no candidates, a `possibly-same-as` LinkedIn candidate, a merged non-LinkedIn candidate; no `reveal_` key in params; skip reason text.
- parse: one Source per social URL in order (twitter→`https://x.com/janad`, github), line 1 `Jana Dvořáková – Data engineer at Kiwi`, line 2 the literal sentence with the confirmed URL, `Current:`, `Location:` and history lines, identity `unverified`; headline fallback `<title> @ <org>`; name fallbacks (first+last, subject).
- parse: `raw` contains none of email, `personal_emails`, `primary_phone`, history emails; `[]` for null person, no usable URL, `"nope"`, `null`, `{ person: { name: 5 } }`.
- parse then `corroboration()`: an enrichment Source for a merged LinkedIn candidate yields reason `cross-link` (add; currently untested end to end).
- normaliseSocialUrl: twitter with query and trailing slash, `www.x.com` with status path, github trailing slash, root path `null`, garbage `null`; add `www.github.com/janad` to `https://github.com/janad` and `github.com/janad/repo` to `https://github.com/janad` (red until the deviation is fixed).
- digest: full shape, `null` for no person and `[]`; the same dedupe of URLs as parse.
