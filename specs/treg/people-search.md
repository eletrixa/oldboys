# Unit: treg people search (`treg/people-search`)

Plan: `plans/016-treg-enrichment/00-SYNTHESIS.md` (step `treg_people_search`, pre-lineup search pool, hiring).

## Purpose
- Find LinkedIn profile candidates for a CV-only run (no LinkedIn candidate merged yet) with one Exa people search through treg, so the identity lineup has profiles to score.
- Pure collector: no fetch, no model; identity stays unverified.

## Files
- `src/recipe/sources/treg/people-search.ts` (export `tregPeopleSearch: Collector`, id `treg/people-search`)
- Tests: `src/recipe/__tests__/treg-search.test.ts` (`describe("tregPeopleSearch")`)
- Uses: `mentionsFullName` (`src/domain/corroborate.ts`), `acceptedCandidates`, `clip`, `identityFor` (`src/recipe/sources/types.ts`)

## Inputs
- `requests(ctx, step)`: `ctx.subject`, `ctx.anchor`, `acceptedCandidates(ctx)`.
- `parse(payload, ctx, step)`: `payload: unknown` (Exa response), `ctx.subject`, `ctx.anchor`.
- `skipReason(ctx)`.
- Payload shape (allow-list, everything else ignored):
  - `{ results: unknown[] }`; each result `{ url: string, title?: string|null, entities?: [{ properties?: { name?, location?, workHistory?: unknown[] } }] }`.
  - work item `{ title?, company?: { name? }, dates?: { from?, to? } }`.

## Outputs
### Request (exactly one, or none)
```ts
{ via: "treg", endpoint: "exa.people.search", method: "POST",
  params: { query: "<subject> <anchor>", category: "people", numResults: 5, includeDomains: ["linkedin.com"] },
  maxCostUsd: 0.01 }
```
- `query` = `` `${subject} ${anchor}`.trim() `` (empty anchor gives the subject alone).

### Sources (`ParsedSource[]`)
- `url`: `https://www.linkedin.com/in/<slug>/` (canonical; scheme, subdomain such as `cz.`, query and trailing path dropped).
- `excerpt` (`clip`ped), newline-joined, empty lines omitted, in this order:
  1. `<name> – <latest title> @ <latest company>`; with only one of title/company: that part alone; with no work history: `<name>`.
  2. `Found by Exa people search for "<query>" via treg`
  3. `Location: <location>` (only when location is non-empty)
  4. up to 4 history lines `<title> @ <company> (<from>–<to>)`, `to` empty = `now`.
- `name` = `properties.name`, else the result `title`.
- `raw`: `{ url, name, location, workHistory }` (allow-list only).
- `identity`: `identityFor(ctx, url)`, expected `"unverified"`; the lineup scores the hit against the anchor and employers; a search hit alone never merges.

## Rules
- Runs only when `ctx.subject.trim() !== ""` and `acceptedCandidates(ctx)` holds no `platform === "linkedin"` candidate (`merge`d; `rejected` / `possibly-same-as` do not block).
- Parse keeps a result only when all hold:
  - `url` parses and its host is `linkedin.com` or a subdomain;
  - path is `/in/<slug>` (company, school, posts pages dropped);
  - `mentionsFullName(ctx.subject, name)` (full name, either order, diacritics- and case-insensitive; a surname-only or other-given-name namesake is dropped);
  - the canonical URL was not already emitted in this payload (first wins, order kept).
- Work history entries that fail the work schema (truncation markers such as `"… 5 more item(s) truncated"`, non-objects) and entries with neither title nor company are skipped; the latest entry is the first valid one.
- No fields beyond name, location and work history are read or kept (no education, email, phone).
- `skipReason(ctx)`: `"no name to search"` when the subject is blank, else `"a LinkedIn profile is already confirmed (given profile)"`.
- Budget/cost handling is the runner's (reserves `maxCostUsd` against `ctx.budget.usd`, no Apify allowance slot); this collector only declares `maxCostUsd 0.01`.

## Failure modes
- Payload not `{ results: array }` (null, string, `results` not an array) → `[]`.
- A malformed result item (not an object, no `url`) → skipped, others still parsed.
- Unparseable or non-LinkedIn URL → skipped.
- Namesake or no name in the result → skipped; nothing found → `[]` (the Workflow records the step as empty, no throw).
- `TREG_TOKEN` unset is handled by the runner (`ports.callTreg === null`), not here.

## Tests that prove it
- Request: exact body above for `baseContext()` (`query "Jana Dvořáková Brno"`); empty anchor gives `query "Jana Dvořáková"`.
- Skips: merged LinkedIn candidate → `[]` and the "already confirmed" reason; `decision: "rejected"` LinkedIn candidate → still one request; blank subject → `[]` and `"no name to search"`.
- Parse: full-name LinkedIn profile kept with canonical URL (`cz.linkedin.com/in/jana-dvorakova-123?trk=x` → `https://www.linkedin.com/in/jana-dvorakova-123/`); `Jana Dvořák` namesake, `/company/`, non-LinkedIn host dropped; duplicate canonical URL (`Dvořáková, Jana`) emitted once.
- Excerpt: line 1, line 2 (`Found by Exa people search for "Jana Dvořáková Brno" via treg`), `Location: Brno, Czechia`, `Data Engineer @ Red Hat (2018-01-01–2021-02-01)`, truncation marker skipped, `identity === "unverified"`.
- Malformed: `null`, `{ results: "x" }`, `{ results: [{ nope: 1 }, 5] }` → `[]`.
