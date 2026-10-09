# docs-sync.md

Rule: a code change and the docs that describe it land in the same commit.

- Before you call a task done, look up every path you changed in the table below. Update each doc that describes the changed behaviour, in the same commit as the code. Docs are not a follow-up task.
- Update only what the change made wrong or missing. No rewrites for style, no new doc just to have one.
- A doc that names a file, route, table, var or script that no longer exists is a bug. Fix the name or remove the line.
- If you cannot update a doc now (a diagram needs a re-render, the doc belongs to someone else), say which doc is stale in your final report and add a line to `PROGRESS.md`.

## Where to look

| You changed | Update |
|---|---|
| `wrangler.jsonc` (binding, var), a new secret or env var | `CLAUDE.md` "Stack and bindings"; `.dev.vars.example`; the runbook in `docs/ops/` for that feature; `docs/cli/cheat/oldboys.ps1` |
| `package.json` scripts | `CLAUDE.md` "Scripts (pnpm)"; `docs/cli/cheat/oldboys.ps1`; `README.md` where it lists commands |
| `migrations/` (new table or column) | `CLAUDE.md` "Ledger" row; `docs/diagrams/database.json`; `CLAUDE.md` "Known gotchas" when remote D1 must be migrated before the deploy |
| A route under `src/app/api/` (new route, auth, status codes, body) | The runbook in `docs/ops/` for that area (`intake.md`, `call-verification.md`, `treg.md`); `CLAUDE.md` where it lists who may call the route; the contract in `specs/` if one exists |
| A page or user flow under `src/app/` | `README.md`; `JURY.md` "Try it"; the `/guide` text (`src/app/guide/guide-content.ts`); `docs/diagrams/user-journey.json` |
| A recipe step, collector or external service (`src/recipe/`, `src/adapters/`) | `CLAUDE.md` "Binding decisions" row of that feature; `docs/diagrams/data-flow.json`, `high-level.json` or `run-sequence.json` when a new service or stage appears; the `docs/ops/` runbook when operators need a key or a check |
| A new top-level folder in `src/`, or a module the "Directory map" calls TODO | `CLAUDE.md` "Directory map" |
| A binding decision (`plans/NNN-*`) | `CLAUDE.md` "Binding decisions" table |
| Behaviour that a file in `specs/` describes | That spec, see [specs.md](specs.md) |
| Any user-visible change | `CHANGELOG.md` under Unreleased (`CLAUDE.md` "Definition of done") |
| Any source file | Its header, see [file-headers.md](../file-headers.md) |

## Diagrams

`docs/diagrams/*.json` is the source of truth. Edit the JSON, re-render it with archify and copy the new `.html` to `public/diagrams/` in the same commit (`docs/diagrams/README.md`). Without archify, edit the JSON and report that the HTML needs a re-render.

## Check

`scripts/agent-check.sh` (pre-commit hook and Claude Code Stop hook) prints a warning when code or config changed and no doc did. It does not block. The warning is a reminder to look at the table, not proof that docs are needed.
