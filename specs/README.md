# specs

One spec per deliverable slice. A spec is the contract an implementing agent works from and the source its Vitest cases come from.

## Rules
- Each slice agent re-reads its spec in the first refactor step (see `rules/tools/specs.md`) and fixes drift in the spec and the code in the same commit.
- Every item under `## Acceptance` maps 1:1 to one test case (`it(...)`). The test title starts with the item id (`A1`, `A2`, ...).
- Specs describe behaviour and shapes, not implementation. Binding decisions stay in `plans/`.

## Format
```
---
spec: <slug>
status: draft
plan: 007
created: 2026-10-08
---
## Intent       why the slice exists, in a few lines
## Contract     files, signatures, shapes, status codes
## Invariants   what must hold in every state
## Acceptance   checklist, one test per item
```

## Index
| Spec | Slice | Main files |
|---|---|---|
| [intake/](intake/) | Candidate intake connectors: email, Google Forms, hosted apply page, StartupJobs (`plans/008-intake-connectors/`; read `intake/00-overview.md` first) | `src/app/api/intake/**` |
| [positions-domain](positions-domain.md) | Zod `Position`, `Family`, questions projection, dedupe key | `src/domain/position.ts` |
| [positions-ingest](positions-ingest.md) | fetch plan, parse, strip, extract, orchestration | `src/recipe/seams/posting-*.ts`, `position-extract.ts`, `src/workflow/ingest-position.ts` |
| [positions-api](positions-api.md) | `/api/positions` routes | `src/app/api/positions/**` |
| [positions-start](positions-start.md) | `positionId` on `POST /api/runs`, state route | `run-body.ts`, `runs/route.ts`, `runs/[id]/state/route.ts` |
| [positions-pages](positions-pages.md) | `/positions`, `/positions/new`, `/positions/[id]`, home, start form, run header | `src/app/positions/**` |
| [positions-purge](positions-purge.md) | expiry sweep of positions and R2 objects | `src/workflow/purge.ts` |
| [positions-research-again](positions-research-again.md) | research a finished candidate again from the position page (`plans/016-treg-enrichment/`) | `src/workflow/enrich.ts`, `src/app/positions/pool-rows.ts` |
| [positions-e2e](positions-e2e.md) | Playwright happy path | `e2e/positions.spec.ts` |

Migration `0011_positions.sql` is defined in `plans/007-position-selector/00-SYNTHESIS.md` (Contracts) and is not repeated here.
