---
plan: 011-profile-suggest
status: draft
owner: Robert
created: 2026-10-09
type: research
---

# LinkedIn profile suggestions on the start form — planning folder

**Goal:** Let a recruiter type a candidate's name on the "Start a brief" card and pick the right public LinkedIn profile from a short list, instead of hunting for the URL. The picked URL feeds the unchanged profile-first flow (plans/006).

**Status:** Draft — PM docs are `docs/13..15`; architecture dossier below; contracts in `00-SYNTHESIS.md`.

**Trigger:** Robert's request 2026-10-09: "at the section where you start a brief and select the LinkedIn profile, can there be a našeptávač".

---

## Read order

| # | Doc | What it does |
|---|-----|--------------|
| **00** | [SYNTHESIS](./00-SYNTHESIS.md) | Decision: contracts, options, matrix, recommendation, risks, TDD order |
| 01 | [Deep dive](./01-deep-dive.md) | Codebase facts + option fact sheet (search APIs, Apify actors) |
| 02 | [Case studies](./02-case-studies.md) | How Clay, Apollo and others resolve names to profiles; search-API experience reports |
| 03 | [Options](./03-options.md) | Candidates A (web-search API), B (Apify SERP actor), C (Apify LinkedIn people-search actor), D (defer: deep link) |
| 04 | [Steelman](./04-steelman.md) | Advocate vs Prosecutor per option, cross-examination |

---

## Out of scope

- Searching inside LinkedIn (people-search pages need a login; hard rule).
- Any identity decision: the picker proposes, the recruiter chooses, the run still resolves namesakes.
- A migration or new table; suggestions are not persisted.
- Changing the extension, intake or `/api/runs` contracts.
