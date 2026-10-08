---
plan: 004-browser-extension
status: draft
owner: Robert
created: 2026-10-08
type: research
---

# Browser extension (Chrome, Edge, Firefox) — architecture decision

**Goal:** decide how the oldboys browser extension is shaped (one codebase for three browsers) and how it talks to the existing Worker for start, status, notify and lineup answer.
**Status:** Draft — dossier complete, decision pending Robert's acceptance (flip to `active` when accepted).
**Trigger:** Robert's ask on 2026-10-08: "mark the candidate on LinkedIn or somewhere, it informs you when the profile is complete, you click and it takes you to the app"; Chrome, Edge and Firefox.

## Read order
| # | Doc | What it does |
|---|-----|--------------|
| **00** | [SYNTHESIS](./00-SYNTHESIS.md) | 5-minute decision summary — matrix, diagrams, recommendation, first TDD steps |
| 01 | [Deep dive](./01-deep-dive.md) | Codebase + official-docs research (MV3, Firefox, Edge, WXT) |
| 02 | [Case studies](./02-case-studies.md) | LinkedIn-adjacent extensions, legal precedent, MV3 production and agentic-era reports |
| 03 | [Options](./03-options.md) | The 3 candidate architectures |
| 04 | [Steelman](./04-steelman.md) | Advocate vs Prosecutor per option, cross-examination |
| — | [evidence/](./evidence/) | Raw research reports with every URL |

Inputs: `docs/04-extension-brainstorm.md`, `docs/05-extension-discovery.md`, `docs/06-extension-pre-mortem.md`.

## Out of scope
- Store publishing and review (post-hackathon week).
- Per-user authentication beyond a pasted token (evolution v3).
- Report page design (core product).
- Safari.

## Cross-references
| Path | What |
|---|---|
| `extension/` | the WXT package (to be created) |
| `src/app/api/runs/` | new `GET /api/runs/:id` status route, `sourceUrl` dedupe on POST |
| `migrations/` | `sourceUrl` column on `investigations` |
| `plans/002-cloudflare-platform/` | platform decision this builds on |
