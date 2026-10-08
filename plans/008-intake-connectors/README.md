---
plan: 008-intake-connectors
status: active
owner: Robert
created: 2026-10-08
type: feature
---

# Candidate intake connectors — planning folder

**Goal:** Open a position on job boards and let every application that arrives by email (Gmail, Seznam, board notifications), from a Google Form, from our hosted apply page or from the StartupJobs webhook become a research run on its own, linked to the application and the position.

**Status:** Active. Research done, decision taken with Robert on 2026-10-08, build in progress against `specs/intake/`.

**Trigger:** Robert's request 2026-10-08: "intake … will work from email or person; connector for email (gmail, seznam), google form, startupjobs, jobs.cz and linkedin jobs; research how it can be done; open the position there and feed it to research; loop it to success."

## Read order

| # | Doc | What it does |
|---|-----|--------------|
| **00** | [SYNTHESIS](./00-SYNTHESIS.md) | Decision: one funnel, three doors; data model; what each board gets |
| 01 | [Connectors research](./01-connectors.md) | Per channel: official path, what we receive, verdict, sources |
| 02 | [Pre-mortem](./02-pre-mortem.md) | Tigers, paper tigers, elephants, go/no-go |

Unit contracts live in [`specs/intake/`](../../specs/intake/00-overview.md). Operations in `docs/ops/intake.md`.

## Out of scope

- LinkedIn Apply Connect / Recruiter System Connect (partner programme, not reachable for a small company).
- An ATS (Teamio, Recruitis) as middle layer.
- IMAP polling of Seznam or Gmail from the Worker.
- Turnstile on the apply page (deferred; same-origin check, honeypot and hourly cap for now).
- Position families and postings (plans/007); this plan adds `intake_tags` and 007 adopts `tag` as its join key.

## Cross-references

| Path | What |
|---|---|
| `specs/intake/` | Contracts per unit, test lists |
| `migrations/0008_intake.sql` | `intake_tags`, `applications`, `investigations.application_id` |
| `src/domain/application.ts` | IntakeInput, statuses, candidateInput, decideStatus |
| `src/workflow/start-run.ts`, `src/workflow/intake.ts` | Shared run start; the funnel |
| `src/workflow/intake-email.ts`, `src/worker.ts` | Email Workers handler |
| `src/app/api/intake/`, `src/app/api/apply/`, `src/app/apply/[tag]/` | Form, StartupJobs, apply page |
| `src/app/intake/` | Operator queue |
| `docs/ops/intake.md` | Email Routing, Gmail, Seznam, Forms, StartupJobs, LinkedIn, Jobs.cz setup; smoke loop |
| `plans/006-profile-first/` | The run input contract this plan feeds |
