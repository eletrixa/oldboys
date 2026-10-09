#!/usr/bin/env bash
# Gate for agents and git hooks: run the repo check suite when code or config changed.
#
# Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
# Module:  scripts/agent-check.sh
# Deps:    git, pnpm (typecheck, lint, test)
# Tested:  n/a
#
# Key responsibilities:
# - Exit 0 fast when only docs/plans/rules changed; otherwise run `pnpm check` and propagate its status
# - Warn (never block) when code or config changed and no doc did (rules/tools/docs-sync.md)
# - Used by .githooks/pre-commit and by the Claude Code Stop hook in .claude/settings.json
#
# Design constraints:
# - Never auto-fix or stage anything; report only
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
changed=$( { git diff --name-only HEAD; git diff --name-only --cached; git ls-files --others --exclude-standard; } | sort -u )
if ! grep -qE '^(src/|extension/|migrations/|scripts/|package\.json|pnpm-lock\.yaml|tsconfig\.json|wrangler\.jsonc|next\.config\.ts|open-next\.config\.ts|eslint\.config\.mjs|vitest\.config\.ts)' <<<"$changed"; then
  echo "agent-check: no code or config changes, skipping" >&2
  exit 0
fi
if ! grep -qE '^(README\.md|CLAUDE\.md|JURY\.md|\.dev\.vars\.example|docs/|specs/|src/app/guide/guide-content\.ts)' <<<"$changed"; then
  echo "agent-check: warning: code or config changed but no doc did; check rules/tools/docs-sync.md" >&2
fi
echo "agent-check: running pnpm check" >&2
pnpm check
