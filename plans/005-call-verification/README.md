---
plan: 005-call-verification
status: draft
owner: Robert
created: 2026-10-08
type: feature
---

# Call verification — planning folder

**Goal:** Prepare the backend so a finished research run can place an operator-approved ElevenLabs phone call that asks the open questions and returns the answers as sourced, honestly labeled evidence.

**Status:** Draft. Dossier complete, Option A recommended, decision pending Robert's acceptance.

**Trigger:** Robert's request 2026-10-08: prepare backend for ElevenLabs verification calls; other devs build the calling UI.

## Read order

| # | Doc | What it does |
|---|-----|--------------|
| **00** | [SYNTHESIS](./00-SYNTHESIS.md) | Decision summary: matrix, diagrams, risks, TDD order |
| 01 | [Brainstorm](./01-brainstorm.md) | PM, Designer and Engineer ideas, Top 5 |
| 02 | [Discovery](./02-discovery.md) | Assumptions A1 to A7, experiments E-C1 to E-C3 |
| 03 | [Options](./03-options.md) | Candidates A (separate Workflow), B (inline step), C (brief only) |
| 04 | [Steelman](./04-steelman.md) | Advocate vs Prosecutor per option, corrections adopted |
| 05 | [Pre-mortem](./05-pre-mortem.md) | Tigers, Paper Tigers, Elephants, Go/No-Go |
| 06 | [ElevenLabs contract](./06-elevenlabs-contract.md) | API facts, webhook shapes, routes the UI developers call |

## Out of scope

- The calling UI (other developers).
- Dialog and agent prompt design beyond the brief contract.
- Twilio account and phone number provisioning (dashboard job).
- An inline `call` recipe step inside `ResearchRunWorkflow` (Option B; reachable later, see the evolution path in 00).
- Scraping or discovering phone numbers. Numbers are operator-entered only.

## Cross-references

| Path | What |
|---|---|
| `src/domain/call.ts` | Call status, brief and result schemas, `transitionCall` |
| `src/domain/call-brief.ts` | Deterministic `buildCallBrief` |
| `src/domain/call-ingest.ts` | Transcript to excerpt and STATEMENT claims |
| `src/domain/elevenlabs-signature.ts` | HMAC verification of the webhook |
| `src/workflow/verification-call.ts` | `VerificationCallWorkflow` |
| `src/workflow/providers/` | ElevenLabs (plain `fetch`) and mock provider adapters |
| `src/app/api/calls/` | Approve, skip and get routes |
| `src/app/api/webhooks/elevenlabs/` | Signed post-call webhook |
| `migrations/0004_calls.sql` | `calls`, `webhook_events`, widened `claims.kind` CHECK |
| `docs/ops/call-verification.md` | ElevenLabs agent setup and manual checklist |
| `plans/001-deep-research-arch/00-SYNTHESIS.md` | Domain decisions this plan extends |
| `plans/002-cloudflare-platform/` | Platform decisions (win on conflict) |
