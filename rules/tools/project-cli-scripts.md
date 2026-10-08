---
rule: project-cli-scripts
title: Project-Local CLI Scripts (Repo Jumper + Cheatsheet)
category: tools
scope: [workflow, powershell, dx]
applies-to: [all]
priority: required
tags: [cli, powershell, ps-profile, repo-jumper, cheatsheet, dx]
created: 2026-04-18
---

# Project-Local CLI Scripts

> [!info] Required for every repo under `F:\code\*`, `F:\soulfire\*`, `F:\code\snuggs\*`, `F:\OH\*`, `F:\tools\*`
> Each project must own its PowerShell shortcuts inside the project itself, not in the central `ps-profile` repo. The PowerShell profile auto-discovers and loads them.

---

## The contract

Every project must contain:

```
<project-root>/
└── docs/
    └── cli/
        ├── repojumper/
        │   └── <name>.ps1     # defines global:Go<Name>
        └── cheat/
            └── <name>.ps1     # defines global:cheat<name> + alias <name>cheat
```

- **One `.ps1` per function**. Filename basename = function suffix in lowercase. `docs/cli/repojumper/velin.ps1` defines `GoVelin`. `docs/cli/cheat/velin.ps1` defines `cheatvelin`.
- **All functions are global scope** (`function global:Foo { … }`) so they survive being dot-sourced by the profile loader.
- **Cheat files own all repo-specific shortcut functions**, not just the cheat itself. If a repo has helper functions like `sbridgedev`, `atodarust`, `startminiapp` etc., they live in the same cheat file alongside `cheat<name>`.
- **Script-scoped state is fine** (`$script:_FooRoot = '…'`) — keep it inside the same file as its consumers.

---

## Why this exists (and why it's required)

The old pattern put every shortcut in `F:\code\ps-profile\profile\40-repo-jumpers.ps1` and `…\98-repo-cheats.ps1`. That meant:

- Devs working inside `F:\code\velin` couldn't see velin's commands without leaving the repo.
- Cloning a project did NOT bring its CLI shortcuts with it.
- Updating a cheatsheet meant editing a foreign repo (`ps-profile`) — easy to forget.

The new pattern keeps everything inside the project that owns it. Versioned with the code. Visible to humans and agents. Updates land in the same commit as the dev-script change that triggered them.

---

## Repo jumper file format

```powershell
<#
.SYNOPSIS
  Jumper: GoVelin — cd to F:\code\velin and print branch.
#>
function global:GoVelin { _GoRepo -Label 'velin' -Candidates @('F:\code\velin') }
```

For repos with env-var path overrides (e.g. `GoMain`, `GoStage`), use the expanded form — see `F:\soulfire\soulfire-main\docs\cli\repojumper\main.ps1` for the canonical example.

The `_GoRepo` helper is provided by `F:\code\ps-profile\profile\40-repo-jumpers.ps1`. Do not redefine it.

---

## Cheatsheet file format

Boxed output with consistent sections. Skip any section that doesn't apply to the repo.

| Section | When to include |
|---|---|
| DEVELOPMENT | Always (dev servers, watch commands) |
| BUILD | If a build step exists |
| CODE QUALITY | Lint, typecheck, format |
| TESTING | Unit, e2e, watch |
| DEPLOYMENT | Deploy commands |
| DATABASE | Migrations, type generation, queries |
| NAVIGATION | Always — shows the `Go<Name>` jumper |

**Visual style** (mandatory):

- Cyan headers (`╔═══╗` / `╚═══╝`)
- Yellow section titles (`│ DEVELOPMENT │`)
- Green commands
- White descriptions
- DarkGray box-drawing and tip text

Always end with:

```powershell
Set-Alias -Name <name>cheat -Value cheat<name> -Scope Global -ErrorAction SilentlyContinue
```

so both `cheatvelin` and `velincheat` work.

Model new files after `F:\code\velin\docs\cli\cheat\velin.ps1`, `F:\code\yoda\docs\cli\cheat\yoda.ps1`, or `F:\code\snuggs\snuggs-bridge\docs\cli\cheat\sbridge.ps1` — they cover the simple, medium, and complex cases respectively.

---

## Refresh trigger

A cheatsheet is a cached projection of the repo's actual dev commands. It drifts the moment those commands change.

**When to refresh**: every session that modifies any of:

- `package.json` scripts
- `wrangler.toml` / `wrangler.jsonc` (new binding, new env, changed deploy command)
- `Cargo.toml` binaries or `cargo tauri` config
- `pyproject.toml` / `uv` scripts
- `bunfig.toml` / `pnpm-workspace.yaml` task definitions
- Introduces a new repo-specific shortcut function (e.g. `sbridgedev`, `atodarust`)

**What to do**: update the matching `<repo>\docs\cli\cheat\<name>.ps1` **in the same commit** as the script change. If the jumper or cheat file is missing entirely, create both before considering the task complete.

**Verification**: run `Reload-ProjectCli` (or `Restart-PSProfile`) and call the cheat function to confirm it renders without errors.

---

## Loader behavior

`F:\code\ps-profile\profile\41-project-cli-loader.ps1` runs at profile bootstrap. It:

1. Iterates roots in `$global:_ProjectCliRoots` (default: `F:\code`, `F:\soulfire`, `F:\code\snuggs`, `F:\Groupon`, `F:\OH`, `F:\tools`).
2. For each immediate subdirectory containing `docs\cli\`, dot-sources every `.ps1` under `docs\cli\repojumper\` and `docs\cli\cheat\`.
3. Wraps each file in try/catch so a single broken script doesn't break the profile.
4. Prints a one-line summary: `[project-cli] Loaded N jumpers + M cheats from K repos`.

Helpers exposed:

- `Reload-ProjectCli` — re-scan without restarting the profile.
- `Show-ProjectCli` — list loaded jumpers/cheats and their source files.

Per-project files **override** any matching definition in the legacy central files (`40-repo-jumpers.ps1` / `98-repo-cheats.ps1`) because the loader runs after them.

---

## Naming rules

- **Jumper**: PascalCase with `Go` prefix → `GoSnuggs`, `GoSBridge`, `GoATODA`. Match existing style; uppercase initialisms stay uppercase (`ATODA`, `HQ`, `MA`, `IBS`).
- **Cheat**: lowercase with `cheat` prefix → `cheatsnuggs`, `cheatsbridge`, `cheatatoda`.
- **Alias**: reverse direction → `snuggscheat`, `sbridgecheat`. Both directions must work.
- **Disambiguation**: if two repos share a name, use the full identifier (`GoSnuggsHQ` vs `GoSnuggs`, `cheatminiapp` vs `cheattelegram`).

---

## Hard requirement

Every active repo under the scan roots must have **at least** `docs/cli/repojumper/<name>.ps1`. A cheat file is required if the repo has any dev/build/test/deploy commands worth documenting (i.e. virtually all of them).

If Claude Code touches a repo that's missing either file, it creates both before marking the task complete.

---

## Related rules

- `tools/git-commit-workflow.md` — commit conventions
- Agent rule: `Project Setup.md` — full directory structure and project init checklist
- Legacy/transition reference: `F:\code\ps-profile\REPO-CONVENTIONS.md`
