---
spec: positions-domain
status: draft
plan: 007
created: 2026-10-08
---
# positions-domain

## Intent
The Position aggregate as pure code: schema, family enum, the projection of must-haves into the run's question list, and shared must-have shaping and the extraction outcome. No I/O.

## Contract
File `src/domain/position.ts`, test `src/domain/__tests__/position.test.ts`. Header per `rules/file-headers.md`.

- `Family`: Zod enum, exactly `engineering | data | product | design | marketing | sales | operations | finance | people | other`. Export `FAMILIES` (the tuple) and `type Family`.
- `MustHave` = Zod object with the same item shape as `MustHaves` in `src/recipe/seams/role.ts`: `id: string` starting with `mh-`, `text: string` (min 1), `title?: string`, `accepted_evidence: string[]`.
- `MustHaves` = `z.array(MustHave).max(MAX_MUST_HAVES)`, `MAX_MUST_HAVES = 5`.
- `Position` = Zod object:
  - `id: string`, `title: string` (trimmed, 1..300), `family: Family`
  - `company?`, `location?`, `board?`, `posting_url?`, `external_id?`: optional strings
  - `must_haves: MustHaves`, `excerpt: string`
  - `ingest_method`: `z.enum(INGEST_METHODS)`, `INGEST_METHODS = ["pasted","jobs-cz","greenhouse","lever","ashby","jsonld"] as const`, type `IngestMethod` (`PostingMethod` in `posting-plan.ts` is an alias)
  - `extraction: "model" | "fallback" | "edited"`: how the must-haves came to be (model output, generic fallback, edited by a user); stored in column `extraction`
  - `ingest_cost_usd: number` (>= 0), `created_at: string`, `expires_at: string` (ISO)
- `fitQuestionText(text, evidence)`: the current `fit()` from `role.ts` moved here unchanged (`text (ev1, ev2)`, cut at 160 chars with a trailing `…`). `role.ts` imports it from here so there is one implementation. Domain must not import from `src/recipe`; `Question` is imported as a type only.
- `mustHavesToQuestions(position: Pick<Position, "must_haves">): Question[]`: for each must-have in order, `{ id, text: fitQuestionText(text, accepted_evidence), title? }`. `title` is included only when, trimmed and cut to 48 chars, it is non-empty. Same shape and truncation as `roleQuestions` output.
- `shapeMustHaves(raw)`: kebab ids, keeps only `mh-` ids, drops base-id collisions and duplicates, cuts `title` to 48, caps at `MAX_MUST_HAVES`. `BASE_IDS` and `kebab` live here and `roleQuestions` and `extractPosition` both use it.
- `fallbackMustHaves(label, where)`: the three generic must-haves (`mh-title-experience`, `mh-public-work`, `mh-location-fit`); an empty label reads "this role", a null place reads "the role".
- `parseMustHaves(json)`: `JSON.parse` plus `MustHaves.safeParse`; null on any failure.
- `POSITION_ID`: `string().trim().min(1).max(64)` matching `/^[A-Za-z0-9_-]+$/`.
- `PositionListItem`: list row type (Position subset plus `company`, `location`, `posting_url` as nullable, and `runs`).
- `errorMessage(e)`: message of an `Error`, else `"unknown error"`.

## Invariants
- A `Position` never holds more than 5 must-haves and every must-have id starts with `mh-`.
- `mustHavesToQuestions` is pure and deterministic; ids and order are preserved.
- Ids never collide with the base hiring ids (`current-role`, `career-history`, `public-code`, `public-talks`, `location-match`, `contradictions`) because of the `mh-` prefix.

## Acceptance
- [ ] A1: `Family` accepts each of the ten values and rejects `"legal"` and `""`.
- [ ] A2: `Position` parses a full valid object and a minimal one (only required fields).
- [ ] A3: `Position` rejects 6 must-haves.
- [ ] A4: `MustHave` rejects an id without the `mh-` prefix (for example `public-code`).
- [ ] A5: `Position` rejects a negative `ingest_cost_usd` and an unknown `ingest_method`.
- [ ] A6: `mustHavesToQuestions` maps a 3-item position to 3 questions with identical ids in identical order.
- [ ] A7: text is `"<text> (<ev1>, <ev2>)"` when evidence is non-empty and plain `<text>` when it is empty.
- [ ] A8: a text-plus-evidence string over 160 chars is cut to exactly 160 chars ending in `…`.
- [ ] A9: `title` is trimmed and cut to 48 chars; an empty or whitespace title yields no `title` key.
- [ ] A10: for the same must-have input, `mustHavesToQuestions` equals what `roleQuestions` would emit for the same `{id,text,title,accepted_evidence}` (use `fakeLlm` returning that input; compare `questions`).
- [ ] A11: `extraction` accepts `model`, `fallback`, `edited` and rejects other values; `shapeMustHaves`, `parseMustHaves`, `fallbackMustHaves` and `POSITION_ID` have one case each.
- [ ] A13: the existing `role.test.ts` still passes unchanged after `fit` moved (run it; no new test).
