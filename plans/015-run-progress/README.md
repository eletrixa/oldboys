---
plan: 015-run-progress
status: draft
owner: Robert
created: 2026-10-09
type: research
---

# Run progress communication — design and architecture decision

**Goal:** the run tray card (the docked "square" that follows runs while the recruiter browses the site) and the full-screen "Research in progress" page must tell the recruiter how long the research takes, what is happening now and what was found so far, without fake precision.

**Status:** Draft — dossier complete, decision pending Robert's acceptance (flip to `active` when accepted).

**Trigger:** Robert, 2026-10-09: "when the new search runs a new brief there needs to be more information in the square that is async when the user can go over the website, and in the full-screen mode; we need to communicate so the user knows how much it takes".

## Read order

| # | Doc | What it does |
|---|-----|--------------|
| **00** | [SYNTHESIS](./00-SYNTHESIS.md) | 5-minute decision summary — matrix, diagrams, recommendation, first TDD steps |
| 01 | [Brainstorm](./01-brainstorm.md) | Round 1: ideas from PM, Designer and Engineer perspectives |
| 02 | [Discovery](./02-discovery.md) | Round 2: assumptions, leap-of-faith risks, validation experiments |
| 03 | [Pre-mortem](./03-pre-mortem.md) | Round 3: Tigers, Paper Tigers, Elephants |
| 04 | [Options and steelman](./04-options-steelman.md) | The four candidate architectures, Advocate vs Prosecutor per option |

## Out of scope

- Making the run itself faster (plans/013-run-latency phases 2–3).
- SSE on the run page (plans/002 keeps polling for the page; the SSE route exists for the extension).
- Any figure about the person (plans/014: no person score).

## Cross-references

| Path | What |
|---|---|
| `src/app/_components/run-tray.tsx`, `run-tray-store.ts` | the tray card |
| `src/app/runs/[id]/run-view.tsx`, `parts.tsx`, `state.ts` | the run page |
| `src/app/api/runs/[id]/state/load.ts` | the state projection the client polls |
| `plans/013-run-latency/01-BASELINE.md` | measured per-step durations the estimate is calibrated on |
