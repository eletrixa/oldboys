---
spec: positions-e2e
status: draft
plan: 007
created: 2026-10-08
---
# positions-e2e

## Intent
One browser test that proves the recruiter path works end to end: paste a posting, see must-haves, start research from the position, find the position in the list.

## Contract
File `e2e/positions.spec.ts` (root Playwright; the repo has no root Playwright config yet, so add `playwright.config.ts` at the root with the web server being the local preview used by `pnpm preview` or `pnpm dev`, one Chromium project, and a root script `e2e` that does not rename existing scripts; update `docs/cli/cheat/oldboys.ps1` in the same commit). The extension keeps its own e2e.

- Setup: local D1 migrated (`pnpm db:migrate:local`), `.dev.vars` provides `RUN_TOKEN`; the test reads the token from the environment variable `E2E_RUN_TOKEN` and skips with a clear message when it is unset. It never prints the token.
- The LLM may be unavailable in e2e (no Anthropic credit, offline). The assertions must pass on the deterministic fallback: at least one must-have, not a specific text. Do not assert on the model's family; the fallback family comes from `familyOf` on the title.
- Posting text used: a short fixed posting titled "Senior Data Engineer" with a Prague location, 300+ characters so it passes the minimum-length rule.
- Steps:
  1. Open `/positions/new`, enter the token in the token form, fill the textarea and the title field, submit.
  2. Expect to land on `/positions/<id>` (URL matches `/positions/[A-Za-z0-9_-]+` but not `/positions/new`; allow up to 60s because ingest may call the LLM), the header shows "Senior Data Engineer", and the must-haves list has at least one item.
  3. Click "Research a candidate"; expect URL `/?positionId=<id>`, the position title visible, and no role input in the form.
  4. Open `/positions`; expect a card with "Senior Data Engineer" inside a section headed `data` (or `other` if the test is run on the fallback with a title the table does not map; the chosen title must map to `data`).
- The test does not start a research run (no spend) and does not need Apify.
- Cleanup: none needed (rows expire); the test uses a unique title suffix so reruns do not collide, and the card assertion matches that suffix.

## Invariants
- No paid call, no LLM requirement, no real person data in the test.
- The test is skipped, not failed, when its prerequisites (token, server) are missing.

## Acceptance
- [ ] E1: pasting the fixed posting on `/positions/new` redirects to `/positions/<id>`.
- [ ] E2: the detail page shows the title and at least one must-have.
- [ ] E3: "Research a candidate" opens `/?positionId=<id>` with the position title and without a role field.
- [ ] E4: `/positions` lists the new position under the `data` section.
- [ ] E5: the spec skips with a message when `E2E_RUN_TOKEN` is unset.
