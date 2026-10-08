# specs/ — unit contracts

One file per unit of work: the contract an implementing agent builds against and the auditor checks the diff against. A spec names inputs, outputs, error cases, the files it owns and the tests that must exist before the code goes green. Specs are written before code (wave 0) and updated in the first refactor pass when the code taught us something; the code never silently drifts from its spec.

| Folder | Feature | Plan |
|---|---|---|
| [intake/](intake/) | Candidate intake connectors: email, Google Forms, hosted apply page, StartupJobs | `plans/008-intake-connectors/` |

Conventions: every file an implementing agent creates carries the header from `rules/file-headers.md`; domain and workflow code ships with a Vitest test in `__tests__/` next to it; `pnpm check` is the gate. Read `specs/intake/00-overview.md` first, then the unit file you were assigned.
