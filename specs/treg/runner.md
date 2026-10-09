# Unit: treg request kind in the runner (`via: "treg"`)

Plan: `plans/016-treg-enrichment/00-SYNTHESIS.md` (rows Request, Port, Runner, Pools, Budget).

## Purpose
- A collector may request one treg.to endpoint call. The runner performs it through `ports.callTreg`, in the same parallel chunks as fetch requests, gated by USD only.

## Files
- `src/recipe/sources/types.ts` (`CollectorRequest`), `src/domain/ports.ts` (`TregCall`, `Ports.callTreg`)
- `src/recipe/runner.ts` (`perform`, `collectWith`), `src/recipe/batch.ts` (`isPaid`)
- `src/workflow/research-run.ts` (`ports()`, `doStep`), adapter `src/adapters/treg.ts` (own spec)
- Tests: `src/recipe/__tests__/runner.test.ts` ("treg requests"), `batch.test.ts`

## Inputs
- Request: `{ via: "treg"; endpoint: string; method: "GET" | "POST"; params: Record<string, string | number | boolean | string[]>; maxCostUsd: number }`
- Port: `TregCall = (req: { endpoint; method; params; maxCostUsd }) => Promise<{ payload: unknown; cost_usd: number }>`; `Ports.callTreg: TregCall | null` (null = `TREG_TOKEN` unset or empty).
- Budget read from `ctx`: `ctx.budget.usd`, `ctx.spent.usd`.

## Outputs
- `StepOutcome.cost_usd` += the `cost_usd` returned by the port, per successful request. `StepOutcome.calls` is never incremented by a treg request (`RUN_BUDGET_CALLS` counts Apify runs only).
- Parsed hits are deduped, stored and attached to `Fetched` exactly as for fetch requests; `Fetched` carries `{req, payload}` with `payload` null for an empty body.
- `isPaid(step)` is false for any actor id starting `treg/`.

## Rules
- `perform`: `via === "treg"` calls `ports.callTreg({endpoint, method, params, maxCostUsd})` and returns `{payload, cost_usd}` unchanged.
- Null port: before any request, if `ports.callTreg === null` and some request is `via: "treg"`, push the note `TREG_TOKEN not set` once and remove every treg request; the remaining (fetch/actor) requests of a mixed collector still run. If none remain, return the empty outcome (empty true, calls 0, no request).
- Parallelism: consecutive non-actor requests (fetch and treg mixed) form a chunk of up to 6 (`FETCH_CONCURRENCY`) and run with `Promise.all`; results are applied in request order. An actor request ends a chunk and runs alone.
- Reservation: per chunk, each treg request reserves its `maxCostUsd`. It is dropped (never called) when `ctx.spent.usd + out.cost_usd + reserved + maxCostUsd > ctx.budget.usd`; the drop pushes the note `run budget reached`. A kept request adds its cap to `reserved`. Reservations are released after the chunk (real cost is in `out.cost_usd`).
- Fetch requests in the same chunk are never dropped by the USD reservation.
- A failed treg request (port throws) pushes `request failed: <message>`, adds no cost, and does not stop the wave.
- `followUp` waves go through the same path (reservation, notes, dedup).
- Workflow (`research-run.ts`):
  - `ports().callTreg` = `null` when `env.TREG_TOKEN` is undefined or `""`, else `makeTregCall(env.TREG_TOKEN)`.
  - `doStep` writes one ledger row per collector step, kind `call`, `cost_usd = out.cost_usd` (Apify plus treg combined), `ref.calls = out.calls`, `ref.notes = out.notes`, `ref.digest` when present.
  - Skip gap: for a collector step with `out.empty && out.notes.length > 0 && (out.calls === 0 || allFailed)` the Workflow records `not searched: <notes joined with "; ">` instead of the recipe `onEmpty` text. `allFailed` = every note starts `request failed` or equals `run budget reached`. So a null-token treg step yields `not searched: TREG_TOKEN not set`; a treg step that made requests but `out.calls === 0` is also reported this way when empty.
  - The run-level guard (`spent.usd >= budget.usd` before the step) writes a `decision` row `skipped: run budget reached` and the same gap, no request.

## Failure modes
- Token unset: note `TREG_TOKEN not set`, no request, gap "not searched: TREG_TOKEN not set".
- Budget short: note `run budget reached`, request dropped, the others in the chunk proceed.
- 402 / 503 / timeout from the adapter: `request failed: …`, step empty if nothing else parsed, gap "not searched: request failed: …".
- Parse throw: pair already in `Fetched`, note `request failed: …`, cost kept.

## Tests that prove it
- performs a treg request through `callTreg`, adds its cost, `calls` 0, stores the source.
- `callTreg: null` → notes `["TREG_TOKEN not set"]`, empty, calls 0, no port call.
- Null port with a mixed collector (fetch + treg): fetch request runs, treg dropped, note present, not empty.
- Cap does not fit remaining USD → `run budget reached`, only fitting requests called.
- Two treg requests in one chunk whose caps sum over the budget: second dropped (reservation is cumulative within a chunk).
- Treg and fetch requests run concurrently (peak in-flight > 1, at most 6) and apply in request order.
- Port throw → `request failed:` note, no cost, other requests still applied.
- `isPaid({kind:"actor", actor:"treg/person-enrich"})` false.
- Workflow: null `TREG_TOKEN` yields the "not searched: TREG_TOKEN not set" gap; ledger `cost_usd` equals `out.cost_usd` (add a doStep-level test if absent).

## Deviations in code
- Deviation in code: none against the dossier for the runner, `isPaid` or `ports()`. Gaps are only in test coverage.
- Deviation in code: the mixed-collector (null port, fetch kept) test, the cumulative-reservation test, the concurrency-of-treg-with-fetch test and the failed-treg-request test are missing from `runner.test.ts`.
- Deviation in code: no Workflow-level test pins the "not searched: TREG_TOKEN not set" gap or the ledger `cost_usd` for a treg step.
- Deviation in code: `run budget reached` is pushed once per dropped request (duplicate notes); the dossier is silent, spec allows dedup to one note.
- Deviation in code: actor budget check uses `<` (`budgetLeft`), treg reservation uses `>` (exact fit allowed); harmless, kept as written.
