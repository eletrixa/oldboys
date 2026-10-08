---
plan: 007-position-selector
status: draft
owner: Robert
created: 2026-10-08
type: research
---

# 007 — Position selector and position clusters

A positions database (families, postings on LinkedIn Jobs / Jobs.cz / ATS pages) that the recruiter opens first, then jumps to the posting, then starts candidate research with the position's must-haves pre-filled. Builds on 006 (profile-first) and the peer's `/roles` coverage pages (idea #16).

## Read order
| # | File | What |
|---|---|---|
| 1 | `00-SYNTHESIS.md` | Decision, matrix, winner diagram, risks, first TDD steps (the ADR) |
| 2 | `12-options.md` | The three candidates with diagrams |
| 3 | `13-steelman.md` | Independent prosecution per option, advocate rebuttals |
| 4 | `10-deep-dive.md` | Codebase seams (start path, `role_questions`, purge, extension) |
| 5 | `11-case-studies.md` | Fetchability matrix per job board, clustering evidence, practitioner reports |

PM inputs (same night, repo convention `docs/NN-*`): `docs/07-position-brainstorm.md`, `docs/08-position-discovery.md`, `docs/09-position-pre-mortem.md`.

Flip `status: draft` → `active` when the decision is accepted.
