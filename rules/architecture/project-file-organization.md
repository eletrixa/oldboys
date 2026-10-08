---
category: architecture
scope: [general]
applies-to: [typescript, javascript]
---

# Project File Organization

Standard directory structure and file placement rules for the codebase.

---

## Description

This rule defines the canonical location for different types of files (source code, tests, documentation, temporary reports) to ensure the repository remains organized and navigable.

---

## Specific Guidelines

### DO:
- Place permanent technical documentation in `/docs/[category]/`
- Place temporary reports, analysis, and WIP docs in `/docs/temp/` with a timestamp
- Keep the root directory (`/`) clean; only essential entry-point docs allowed (e.g., `README.md`)
- Place source code in `/src/`
- Place integration/E2E tests in `/tests/`
- Co-locate unit tests with source files in `__tests__` directories

### DON'T:
- Create analysis reports or detailed docs in the root directory
- Create "misc" or "utils" folders in root; put them in `src` or `scripts`
- Mix permanent documentation with temporary scratchpads in `/docs`
- Use uppercase filenames for non-root documentation (except special cases like `README`)

---

## Implementation Details

### Directory Structure Roles

| Directory | Purpose | Allowed Content |
|-----------|---------|-----------------|
| `/` (Root) | Entry points | `README.md`, `GETTING-STARTED.md`, config files |
| `/docs/` | Permanent Docs | Subdirs: `architecture`, `guides`, `testing`, etc. |
| `/docs/temp/` | Temporary/WIP | AI reports, test results, dated files (`analysis-2025-12-01.md`) |
| `/src/` | Source Code | Application code, organized by feature/layer |
| `/tests/` | Global Tests | `integration/`, `e2e/`, shared test utils |
| `/scripts/` | Automation | Build scripts, migrations, maintenance tools |

### File Naming Conventions

1.  **Root Docs**: `UPPERCASE-WITH-HYPHENS.md` (e.g., `GETTING-STARTED.md`)
    *   *Exception*: Keep standard files like `README.md` as is.
2.  **Subdirectory Docs**: `lowercase-with-hyphens.md` (e.g., `docs/architecture/payment-system.md`)
3.  **Temporary Files**: `description-YYYY-MM-DD.ext` (e.g., `docs/temp/lint-report-2025-12-01.md`)

---

## Benefits

1.  **Navigability**: Developers know exactly where to look for code vs. docs.
2.  **Clutter Control**: Prevents the root directory from becoming a dumping ground.
3.  **Lifecycle Management**: clear distinction between permanent docs and temporary artifacts makes cleanup easier.

---

## Examples

### Correct: Creating an Analysis Report
**Path**: `/docs/temp/performance-analysis-2025-12-20.md`
*   Status: Temporary, dated.

### Correct: Creating Architecture Documentation
**Path**: `/docs/architecture/notification-system.md`
*   Status: Permanent, categorized.

### Incorrect: Root Clutter
**Path**: `/my-new-feature-notes.md`
*   Issue: Should be in `/docs/temp/` or `/docs/guides/` depending on permanence.

### Incorrect: Mixed Case in Docs
**Path**: `/docs/guides/TestingGuide.md`
*   Issue: Should be `/docs/guides/testing-guide.md`.
