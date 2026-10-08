---
spec: positions-ingest
status: draft
plan: 007
created: 2026-10-08
---
# positions-ingest

## Intent
Turn a pasted posting or a posting URL into a stored `Position` with at most 5 editable must-haves, at a recorded cost, without any paid actor. Paste always works; fetch paths are additive.

## Contract
Files and tests:
- `src/recipe/seams/posting-plan.ts` / `src/recipe/__tests__/posting-plan.test.ts`
- `src/recipe/seams/posting-parse.ts` / `src/recipe/__tests__/posting-parse.test.ts` (fixtures under `src/recipe/__tests__/fixtures/postings/`)
- `src/recipe/seams/posting-strip.ts` (`stripBoilerplate`, tested in `posting-parse.test.ts`)
- `src/recipe/seams/position-extract.ts` / `src/recipe/__tests__/position-extract.test.ts`
- `src/workflow/ingest-position.ts` / `src/workflow/__tests__/ingest-position.test.ts` (fake D1, fake R2, injected `fetch`)

### postingFetchPlan(url: string | null)
Returns `{ method, request?: { url: string }, board?: string, externalId?: string }`. Pure, never throws; an unparsable string is treated as no URL.

| Input | method | request.url | board | externalId |
|---|---|---|---|---|
| `null` or empty | `pasted` | none | none | none |
| `https://(www.)jobs.cz/rpd/<id>/...` | `jobs-cz` | the input URL without fragment | `jobs.cz` | `<id>` |
| `https://boards.greenhouse.io/<board>/jobs/<id>` and `https://job-boards.greenhouse.io/<board>/jobs/<id>` | `greenhouse` | `https://boards-api.greenhouse.io/v1/boards/<board>/jobs/<id>` | `greenhouse:<board>` | `<id>` |
| `https://boards.greenhouse.io/<board>?gh_jid=<id>` (same for `job-boards`) | `greenhouse` | same API URL | `greenhouse:<board>` | `<id>` |
| `https://jobs.lever.co/<co>/<uuid>` | `lever` | `https://api.lever.co/v0/postings/<co>/<uuid>` | `lever:<co>` | `<uuid>` |
| `https://jobs.ashbyhq.com/<org>/<uuid>` | `ashby` | `https://api.ashbyhq.com/posting-api/job-board/<org>` | `ashby:<org>` | `<uuid>` |
| any other `http(s)` URL (including `?gh_jid=` on a non-Greenhouse host, where the board slug is unknown) | `jsonld` | the input URL | none | none |
| non-http(s) scheme (`javascript:`, `file:`) | `pasted` | none | none | none |

### parsePosting(method, payload, externalId?)
Returns `{ title?: string, company?: string, location?: string, text: string }`; never throws, an unreadable payload gives `{ text: "" }`.
- `jobs-cz` and `jsonld`: payload is an HTML string (checked 2026-10-08: live Jobs.cz `/rpd/<id>` pages carried no JSON-LD, so `jobs-cz` currently yields `{ text: "" }` and ingest falls back to paste; the parser contract is tested on a synthesized fixture); read every `<script type="application/ld+json">`, find a `JobPosting` (also inside `@graph` or an array); `title`, `hiringOrganization.name`, `jobLocation.address.addressLocality` (or `jobLocation[0]`), `description` (HTML to text: tags removed, entities decoded, block tags become newlines).
- `greenhouse`: JSON `{ title, location.name, company_name?, content }`; `content` is HTML-escaped HTML, unescape then to text.
- `lever`: JSON `{ text, categories.location, descriptionPlain, lists[] }`; `text` field of the result = `descriptionPlain` plus each list as `heading` line and items.
- `ashby`: JSON `{ jobs: [...] }`; choose the entry whose `id` equals `externalId`; use `title`, `location`, `descriptionPlain` (else `descriptionHtml` to text). No match gives `{ text: "" }`.
- `pasted`: payload is the string; `text` = the string trimmed; no title.

### stripBoilerplate(text)
Removes sections whose heading line matches (case-insensitive, optional trailing colon) `About us`, `About the company`, `O nás`, `Benefits`, `Benefity`, `Co nabízíme`, `Equal opportunity`, `EEO`, from the heading through the line before the next heading. A heading is a line that is short (<= 60 chars), has no sentence-ending period, and is either `#`-prefixed, ends with a colon, or is the only text on its line between blank lines. Other sections are kept verbatim. Idempotent.

### extractPosition(text, ports, hint?)
`ports: Pick<Ports, "llm">`, `hint?: { title?: string; company?: string; location?: string }` (values from parsePosting or the request body). Returns `{ title, company?, location?, family, must_haves, cost_usd, notes: string[] }`.
- One `llm` call (`model: "primary"`) with a Zod schema `{ title, company, location, family: Family, must_haves[] }`. Must-haves are post-processed exactly like `roleQuestions`: kebab ids, `mh-` prefix enforced, no duplicates, no base ids, at most 5. Prompt forbids Art. 9 criteria (health, politics, religion, ethnicity, sexuality) and personality or trustworthiness traits.
- Title: `hint.title` wins when non-empty, else the model's.
- Family fallback when the model value is invalid: `familyOf(title)`, a CZ/EN keyword table (for example `data engineer|analyst|ml` gives `data`, `vývojář|developer|engineer` gives `engineering`, `obchodní|sales|account` gives `sales`), else `other`. Export `familyOf` and test it.
- Deterministic fallback when the call throws or yields zero usable must-haves: exactly 3 generic must-haves (same three ids and wording as `roleQuestions` fallback: `mh-title-experience`, `mh-public-work`, `mh-location-fit`, expressed as `MustHave` with `accepted_evidence`), `family = familyOf(title)`, `cost_usd = 0` on throw, and a note starting `position extract:` that says why (`LLM failed (<message>)` or `no usable LLM output`).

### ingestPosition(deps, body)
`deps = { db: D1Database, bucket: R2Bucket, ports: Pick<Ports,"llm">, fetchFn: typeof fetch, now: Date, newId: () => string, capUsd: number, estimateUsd: (text: string) => number }`; `body = { postingText?, postingUrl?, title? }` already validated.
Order: `postingFetchPlan(postingUrl ?? null)` -> dedupe check -> fetch -> `parsePosting` -> `stripBoilerplate` -> `extractPosition` -> insert row -> R2 put -> return.
1. Method is `pasted` when no URL; the text is `postingText`.
2. Dedupe: when the plan has `board` and `externalId` and a row with that pair exists, return `{ ok: true, id: existing, reused: true }` before any fetch or LLM call.
3. Fetch with a 20 s abort. Non-2xx, timeout, throw, or parsed `text` shorter than 200 chars counts as a fetch failure. On failure with `postingText` present: continue as `pasted` and add a note naming the failed method. On failure without `postingText`: return `{ ok: false, status: 422, error }` with a plain reason (`could not read the posting at <host>: <why>; paste the posting text instead`).
4. If both `postingText` and a fetchable URL are given, the fetched text wins and `postingText` is the fallback; the URL stays as `posting_url`.
5. Cost cap: when `estimateUsd(text) > capUsd`, `extractPosition` is not called; the fallback is used with a note `position extract: estimated cost over POSITION_INGEST_USD, used generic fallback`. `capUsd` comes from var `POSITION_INGEST_USD`, default 0.05 when unset or not a number. `estimateUsd` is a module function (characters / 4 tokens times a conservative input price plus a fixed output allowance); tests inject it.
6. Row: `id = newId()`, `excerpt` = first 1000 chars of the stripped text, `must_haves_json` = JSON of the must-haves, `ingest_method` = the method actually used, `ingest_cost_usd = cost_usd`, `created_at = now`, `expires_at = now + RETENTION_DAYS`, `r2_key = positions/<id>.json`, `board`/`external_id`/`posting_url` from the plan. Notes are stored in the R2 object, not in D1.
7. R2 object `positions/<id>.json` = `{ method, url, fetched_at, raw (payload or pasted text), notes }`. A failed R2 put must not fail the ingest: the row is kept with `r2_key = null` and the failure goes into the returned `notes`.
8. Return `{ ok: true, id, reused: false, notes }`.
9. A concurrent insert that violates the `(board, external_id)` unique index returns the existing id with `reused: true`.

## Invariants
- No paid Apify call anywhere in ingest. The only spend is the single capped LLM call, written to `ingest_cost_usd`.
- Paste works with the LLM down: the result always has 3 to 5 must-haves.
- Fetched hosts are only the ones in the plan table or the user's own URL over http(s); no request is made for `pasted`.
- Raw posting data is purged with the row (`expires_at`); nothing is kept past `RETENTION_DAYS`.
- No Art. 9 data or personality criteria in generated must-haves (prompt rule; a test asserts the system prompt contains the prohibition).

## Acceptance
posting-plan
- [ ] P1: `null`, `""` and `"not a url"` give `pasted` with no request.
- [ ] P2: `https://www.jobs.cz/rpd/2000123456/?searchId=x` gives `jobs-cz`, board `jobs.cz`, externalId `2000123456`.
- [ ] P3: `boards.greenhouse.io/acme/jobs/12345` and `job-boards.greenhouse.io/acme/jobs/12345` give the boards-api URL, board `greenhouse:acme`.
- [ ] P4: `boards.greenhouse.io/acme?gh_jid=12345` gives the same API URL; `https://careers.example.com/jobs?gh_jid=12345` gives `jsonld`.
- [ ] P5: `jobs.lever.co/acme/<uuid>` gives the `api.lever.co/v0/postings/acme/<uuid>` URL.
- [ ] P6: `jobs.ashbyhq.com/acme/<uuid>` gives the job-board API URL with externalId `<uuid>`.
- [ ] P7: `https://example.com/careers/dev` gives `jsonld`; `javascript:alert(1)` and `file:///etc/passwd` give `pasted`.
posting-parse
- [ ] R1: Jobs.cz fixture HTML gives title, company, locality and a text containing the description with tags removed.
- [ ] R2: a JSON-LD `JobPosting` inside `@graph` is found; a page with no JobPosting gives `{ text: "" }`.
- [ ] R3: Greenhouse fixture JSON gives title, location and unescaped text.
- [ ] R4: Lever fixture JSON includes the list headings and items in `text`.
- [ ] R5: Ashby fixture picks the job matching `externalId` among several; unknown id gives `{ text: "" }`.
- [ ] R6: `pasted` returns the trimmed string and no title; non-string or malformed payloads never throw.
- [ ] R7: `stripBoilerplate` removes an English `About us` and a Czech `Co nabízíme` section and keeps `Requirements` and `Responsibilities` intact.
- [ ] R8: `stripBoilerplate` removes `Benefits:` through the next heading only, and is idempotent.
- [ ] R9: text with none of the headings is returned unchanged.
position-extract
- [ ] X1: with `fakeLlm` output of 4 valid must-haves, the result has 4 with `mh-` ids, a valid family, and `cost_usd` from the fake.
- [ ] X2: 8 model must-haves are cut to 5; an id without `mh-` is prefixed or dropped as `roleQuestions` does; a base id and duplicates are dropped.
- [ ] X3: `hint.title` overrides the model title.
- [ ] X4: an invalid family from the model falls back to `familyOf(title)`; `familyOf("Senior Data Engineer")` is `data`, `familyOf("Obchodní zástupce")` is `sales`, `familyOf("Zookeeper")` is `other`.
- [ ] X5: when the LLM throws, the result has exactly the 3 generic must-haves, family from `familyOf`, `cost_usd` 0, and a note containing the error message.
- [ ] X6: when the model returns only unusable must-haves, the same 3 fallbacks and a note `no usable LLM output`.
- [ ] X7: the system prompt passed to the LLM forbids health, politics, religion, ethnicity, sexuality and personality or trustworthiness criteria.
ingest-position
- [ ] I1: pasted text with a working LLM inserts one row with method `pasted`, 3 to 5 must-haves, cost from the LLM, `expires_at` = now + 7 days, and puts `positions/<id>.json` in R2; returns `{ ok: true, reused: false }`.
- [ ] I2: pasted text with a throwing LLM still inserts a row with exactly 3 fallback must-haves and cost 0.
- [ ] I3: a Greenhouse URL fetches the boards-api URL (assert the fetch call), stores board `greenhouse:acme` and external id, method `greenhouse`.
- [ ] I4: ingesting the same Greenhouse URL twice returns the first id with `reused: true`, and the second call makes no fetch and no LLM call.
- [ ] I5: URL fetch fails (503) with no `postingText` returns `{ ok: false, status: 422 }` with a reason naming the host, and inserts nothing.
- [ ] I6: URL fetch fails with `postingText` given: row inserted with method `pasted`, a note names the failed method.
- [ ] I7: a fetch that never resolves is aborted at 20 s (fake timers) and treated as failure.
- [ ] I8: `estimateUsd` above `capUsd` skips the LLM (assert zero calls), uses the fallback, and the note mentions `POSITION_INGEST_USD`.
- [ ] I9: an R2 put failure still returns `ok: true`, with `r2_key` null and a note.
- [ ] I10: the unique-constraint race returns the existing id with `reused: true`.
- [ ] I11: the title in the body overrides the extracted title in the stored row.
