# Changelog

## v0.2 (2026-10-09)

### Candidate intake connectors

Job applications from email, Google Forms, a hosted apply page and a StartupJobs webhook become one `applications` row each and, for a known position tag with a LinkedIn URL or readable CV, one research run. Decision: `plans/008-intake-connectors/`. Contracts: `specs/intake/`. Operator runbook: `docs/ops/intake.md`.

#### Changes
- **One funnel**: `ingestApplication` is the only writer of `applications` and the only intake path to a run; idempotent per `(source, external_id)`, statuses `received`, `run-started`, `unmatched`, `incomplete`, `capped`.
- **Position tags**: `intake_tags` maps a tag (plus-address, apply path, form field, StartupJobs offer) to a role and goal; an unknown tag never starts a run.
- **Spend brake**: `INTAKE_PER_HOUR_CAP` (default 10) counts `investigations.via = 'intake'` per hour, on top of the existing `RUNS_PER_HOUR_CAP`.
- **Email door**: Cloudflare Email Routing on `asajj.cz` (`jobs@` rule and catch-all to the Worker), `worker.email()` parses with `postal-mime`, reads CV text from PDF with `unpdf`, forwards a copy to `INTAKE_FORWARD_TO`, honours `INTAKE_FROM_ALLOW`.
- **Form door**: `POST /api/intake/form` with bearer `INTAKE_TOKEN`, fed by a Google Apps Script `onFormSubmit` trigger; never returns a run id.
- **Apply page**: public `/apply/<tag>` and `POST /api/apply` (same-origin check, honeypot); the candidate only ever sees "received".
- **StartupJobs door**: `POST /api/intake/startupjobs/<token>` answers only codes that keep the webhook alive (200, 202, 422; 404 for a wrong token), downloads the first PDF from `files[]`.
- **Operator UI**: `/intake` queue and tag form, `GET /api/intake/applications`, `GET|POST /api/intake/tags`, "From <source> · <tag> · <date>" line on the run page.
- **Run start extracted**: `startRun` and `runsStartedSince` shared by `POST /api/runs` and the funnel; behaviour of `POST /api/runs` unchanged.
- **Config and docs**: vars `INTAKE_PER_HOUR_CAP`, `INTAKE_FORWARD_TO`, `INTAKE_FROM_ALLOW`; secrets `INTAKE_TOKEN`, `STARTUPJOBS_WEBHOOK_TOKEN`, `STARTUPJOBS_TOKEN`; no new bindings.
- **Migration**: adds `intake_tags`, `applications` and `investigations.application_id`. CI cannot migrate D1; Robert runs `pnpm db:migrate:remote` before the deploy.

#### Files Added
- `specs/intake/*.md` - Unit contracts (overview, data, funnel, email, form, apply page, StartupJobs, UI, ops)
- `plans/008-intake-connectors/` - Decision dossier (synthesis, connector research, pre-mortem)
- `migrations/0009_intake.sql` - `intake_tags`, `applications`, `investigations.application_id`
- `src/domain/application.ts` - Intake schemas, `candidateInput`, `decideStatus`, `safeFilename`, `cvR2Key`
- `src/domain/cv-text.ts` - CV text extraction from PDF and plain text
- `src/domain/email-intake.ts` - Pure mail helpers and `parseIntakeMail`
- `src/domain/startupjobs.ts` - Webhook payload schema and mapping
- `src/workflow/start-run.ts` - `startRun`, `runsStartedSince`
- `src/workflow/intake.ts` - `ingestApplication`
- `src/workflow/intake-email.ts` - `handleIntakeEmail`
- `src/app/api/intake/form/` - Form route and handler
- `src/app/api/intake/startupjobs/` - Webhook route and handler
- `src/app/api/intake/applications/` - Queue route
- `src/app/api/intake/tags/` - Tag list and create route
- `src/app/api/apply/` - Apply route and handler
- `src/app/api/_lib/intake-body.ts` - Shared body schema for form and apply
- `src/app/api/_lib/origin.ts` - `fromOurPage`, moved out of `/api/start`
- `src/app/apply/[tag]/` - Hosted apply page and form
- `src/app/intake/` - Operator queue page and tag form
- `src/domain/__tests__/fixtures/*.eml` - Gmail, Seznam, Jobs.cz and no-tag mail fixtures
- `docs/ops/intake.md` - Operator runbook with the Apps Script, mailbox rules, webhook setup, smoke loop and troubleshooting
- `versions.md` - This changelog

#### Files Modified
- `src/worker.ts` - Exports `email`
- `src/app/api/runs/route.ts` - Calls `startRun`
- `src/app/api/start/route.ts` - Imports `fromOurPage`
- `src/app/api/_lib/auth.ts` - `requireBearer` takes the secret name for the 503 message
- `src/app/api/runs/[id]/state/route.ts`, `src/app/runs/[id]/state.ts`, `src/app/runs/[id]/run-view.tsx` - Intake line on the run page
- `src/domain/run-status.ts` - `INTAKE_PER_HOUR_CAP_DEFAULT`
- `src/domain/run-body.ts` - `CV_MAX` re-exported from `application.ts`
- `package.json`, `pnpm-lock.yaml` - Dependencies `postal-mime`, `unpdf`
- `wrangler.jsonc` - Intake vars
- `cloudflare-env.d.ts` - Intake vars
- `src/env-secrets.d.ts` - Optional intake secrets
- `.dev.vars.example` - Intake secrets
- `docs/cli/cheat/oldboys.ps1` - INTAKE section
- `CLAUDE.md` - Decision 008, vars and secrets, `specs/` in the directory map

---

## v0.1 (2026-10-08)

### Research platform up to plan 007

History summarised from `git log`; each line is one feature plan.

#### Changes
- **001 Deep research architecture**: declared recipe per goal, claims with references and rank, FACT split from INFERENCE, verify by quote and ledger, identity merge or ask, budget enforced in the runner; hiring and due-diligence recipes with live collectors (`2f81913`, `54b6829`, `882437d`, `2b0e1ac`).
- **002 Cloudflare platform**: Next.js 16 on Workers via OpenNext, D1 ledger, R2 raw sources, Workflow `ResearchRunWorkflow`, SSE polling, custom domain `oldboys.asajj.cz`, nightly purge cron (`8974184`, `ce9dc49`, `e501a05`, `8c9272c`, `b1a363d`).
- **004 Browser extension**: WXT launcher for Chrome, Edge and Firefox, status polling and notification, Playwright smoke (`939b72a`, `a3d735f`, `60852af`).
- **005 Call verification**: operator-approved ElevenLabs calls to consenting callees, `VerificationCallWorkflow`, webhook transcript ingested as STATEMENT claims, mock provider labeled MOCK (`f74f892`, `2d46882`, `eac6e89`).
- **006 Profile-first start**: LinkedIn URL or pasted CV plus role starts a run, `seed_profile` step, identity map, candidate notice, GDPR audit record, interview kit, candidates overview, brief sections with deterministic confidence (`2dacd8d`, `0d7e3de`, `cad8e8a`, `fb344f5`, `f96bbbc`).
- **007 Position selector**: dossier only (`plans/007-position-selector/`, on another branch, not in this history); tags in v0.2 are the join key it will build on.

---
