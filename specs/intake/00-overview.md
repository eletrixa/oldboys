# Intake — overview (read first)

**Goal.** A job application that arrives by email, from a Google Form, from our hosted apply page or from a StartupJobs webhook becomes one `applications` row and, when it carries enough to research, one research run, with no human re-entry. Every connector normalises into the same `IntakeInput` and calls the same funnel.

```
jobs+<tag>@asajj.cz (Gmail fwd, Seznam copy, Jobs.cz / LinkedIn notifications) ─► worker.email() ──┐
POST /api/intake/form   (Google Forms via Apps Script, bearer INTAKE_TOKEN) ───────────────────────┤
POST /api/apply         (hosted /apply/<tag> page, same-origin + honeypot) ─────────────────────────┤──► ingestApplication() ──► applications ──► startRun() ──► investigations (via='intake', application_id)
POST /api/intake/startupjobs/<token> (webhook carries the full application; CV from files[0]) ──┘
```

## Vocabulary

- **tag** — the routing key of an open position: `[a-z0-9][a-z0-9-]{1,39}`. Lives in `intake_tags` (tag → role, goal). It is the plus-address (`jobs+senior-be@asajj.cz`), the apply page path (`/apply/senior-be`), the Google Form hidden field and the StartupJobs offer mapping. Plans/007 will fold it into `positions`; `tag` stays the join key.
- **IntakeInput** — what a connector hands the funnel (`src/domain/application.ts`): `{source, externalId, tag, name?, email?, phone?, linkedinUrl?, cvText?, cv?: {bytes, filename, contentType}, coverLetter?, note?}`.
- **application** — one D1 row per `(source, external_id)`. Status: `received` (inserted, not yet decided) → `run-started` | `unmatched` (no or unknown tag, or sender not allowed) | `incomplete` (matched but no LinkedIn URL and no readable CV text) | `capped` (matched and complete, but `INTAKE_PER_HOUR_CAP` reached).
- **candidate input** — what a run needs (plans/006): `profileUrl` (normalised LinkedIn) or `cvText` (≤ 20000 chars), plus `role` from the tag.

## Rules every unit obeys

1. The funnel is the only place that writes `applications` or starts a run. Connectors parse and call `ingestApplication`; they never touch `investigations`.
2. Idempotent: the same `(source, externalId)` twice returns the first row (`duplicate: true`), no second run.
3. Spend brake: a run starts only for a known tag; `INTAKE_PER_HOUR_CAP` (var, default 10) counts `investigations.via = 'intake'` in the last hour. The existing `RUNS_PER_HOUR_CAP` (20) still applies on top.
4. The candidate never learns a run exists. The apply page answers "received"; no run id leaves the funnel except to operator routes.
5. CV bytes go to R2 `intake/<applicationId>/<safe-filename>`; text extracted from PDF only (`unpdf`); anything else is stored and noted, not parsed.
6. Secrets and vars: `INTAKE_TOKEN` (secret, bearer for /api/intake/form), `STARTUPJOBS_WEBHOOK_TOKEN` (secret, path token), `STARTUPJOBS_TOKEN` (secret, only for retrying a CV download that answers 401/403), vars `INTAKE_PER_HOUR_CAP`, `INTAKE_FORWARD_TO` (verified Email Routing destination, may be empty), `INTAKE_FROM_ALLOW` (comma list of sender domains or addresses allowed to start runs by email; empty = any sender). All optional secrets typed `string | undefined` in `src/env-secrets.d.ts`.
7. Workflow-layer code (`src/workflow/*`) imports only `src/domain`, `src/recipe`, `src/adapters` and npm packages; never Next.js. Route files are thin and call a `handler.ts` that takes bindings as parameters so Vitest runs under plain Node (pattern: `src/app/api/webhooks/elevenlabs/handler.ts` + its test).
8. TDD: red → green → refactor 1 (re-read this spec and your unit spec, fix drift) → refactor 2 (read `rules/README.md`, follow `rules/crossroads.md` for the files you touched, fix drift, headers) → `pnpm check`.

## Units

| Unit | Spec | Owner wave |
|---|---|---|
| Data | [data.md](data.md) | 1 |
| Funnel + start-run extraction | [funnel.md](funnel.md) | 1 |
| Email connector | [email.md](email.md) | 2 |
| Form connector | [form.md](form.md) | 2 |
| Hosted apply page | [apply-page.md](apply-page.md) | 2 |
| StartupJobs connector | [startupjobs.md](startupjobs.md) | 2 |
| Operator UI | [ui.md](ui.md) | 3 |
| Ops, docs, config | [ops.md](ops.md) | 2 |
