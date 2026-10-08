# Unit: ops, config, docs, changelog

## Files
- `docs/ops/intake.md` (new): purpose and rules; Cloudflare Email Routing (enabled via API by Fable: zone `asajj.cz`, rule `jobs@asajj.cz → worker oldboys`, destination address verification by Robert); Gmail filter "forward to jobs+<tag>@asajj.cz" and the confirmation mail; Seznam rule "Pošli kopii"; Google Form fields + the Apps Script (full code block) + trigger install; hosted apply page URL; StartupJobs webhook URL + test button; LinkedIn Jobs "apply on external website"; Jobs.cz contact address + apply link; the smoke loop (curl examples for each endpoint, `/cdn-cgi/handler/email` for local email); troubleshooting table (status → cause → fix).
- `.dev.vars.example`: `INTAKE_TOKEN`, `STARTUPJOBS_WEBHOOK_TOKEN`, `STARTUPJOBS_TOKEN` with one-line comments.
- `src/env-secrets.d.ts`: the three optional secrets.
- `wrangler.jsonc` vars: `INTAKE_PER_HOUR_CAP: "10"`, `INTAKE_FORWARD_TO: ""`, `INTAKE_FROM_ALLOW: ""` with a comment; no new bindings.
- `docs/cli/cheat/oldboys.ps1`: INTAKE section (secrets, endpoints, local email curl, migrate).
- `versions.md` (new, per `rules/tools/changelog-workflow.md`): `## v0.2 (2026-10-09)` entry "Candidate intake connectors" with Changes / Files Added / Files Modified; earlier history summarised in one `## v0.1` block from `git log` (one line per feature plan 001–007).
- `CLAUDE.md`: binding-decisions line gains 008; bindings paragraph gains the new vars/secrets; directory map gains `specs/`.
- `plans/008-intake-connectors/`: written by Fable in wave 0.

## Checks
- `pnpm cf-typegen` regenerates `cloudflare-env.d.ts` with the new vars (commit it if the repo tracks it; check `git ls-files cloudflare-env.d.ts`).
- Every new `.ts`/`.tsx`/`.sql` file carries the header from `rules/file-headers.md`.
