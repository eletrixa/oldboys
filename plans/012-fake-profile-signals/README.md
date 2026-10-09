---
plan: 012-fake-profile-signals
status: draft
owner: Robert
created: 2026-10-09
type: research
---

# Fake / impersonated profile signals — architecture decision

**Goal:** decide how oldboys detects and reports fake, impersonating or bot-like social profiles around a candidate (and fabrication signals on the confirmed profile) as a sourced red flag in the hiring report.

**Status:** Draft — dossier complete, decision pending Robert's acceptance (flip to `active` when accepted). Implementation in progress on branch `fake` (worktree oldboys-fake).

**Trigger:** Robert, 2026-10-09: "fake account detection, that would be a red flag at the profile".

## Read order

| # | Doc | What it does |
|---|-----|--------------|
| **00** | [SYNTHESIS](./00-SYNTHESIS.md) | 5-minute decision summary |
| 01 | [Deep dive](./01-deep-dive.md) | Codebase + research on detection signals |
| 02 | [Case studies](./02-case-studies.md) | Real-world experience, tools, legal |
| 03 | [Options](./03-options.md) | Candidate architectures |
| 04 | [Steelman](./04-steelman.md) | Advocate vs Prosecutor |
| 05 | [Discovery](./05-discovery.md) | pm:discover + pm:brainstorm output |
| 06 | [Pre-mortem](./06-pre-mortem.md) | pm:pre-mortem output |

## Out of scope

- Photo processing of any kind (reverse image search, perceptual hash, AI-image scores): evolution path v2/v3, gated by a legal note and spike E1.
- Employer existence lookups (ARES): most LinkedIn employers are not Czech legal entities; deferred.
- Any score, badge or count: the brief forbids trustworthiness scores.

## Cross-references

| Path | What |
|---|---|
| `src/domain/profile-facts.ts` | `ProfileFacts` value object, ledger read-back |
| `src/domain/profile-signals.ts` | rules table, `profileSignals` |
| `src/recipe/sources/*.ts` | `digest()` per platform collector, merged accounts only |
| `src/recipe/seams/seed.ts`, `src/workflow/research-run.ts` | seed step writes the LinkedIn facts |
| `src/app/api/runs/[id]/state/load.ts`, `src/app/runs/[id]/profile-signals-card.tsx`, `interview-kit.ts` | state field, card, kit section |
