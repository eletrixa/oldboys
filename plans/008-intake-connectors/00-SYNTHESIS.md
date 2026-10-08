# 00 — Synthesis: one funnel, three doors

**Decision (Robert, 2026-10-08):** every application channel normalises into one `applications` row and one code path starts the research run. Email (Cloudflare Email Routing on `asajj.cz`), an authenticated JSON endpoint (Google Forms via Apps Script) and a hosted apply page cover Gmail, Seznam, Google Forms, Jobs.cz and LinkedIn Jobs; StartupJobs gets its own thin webhook route because it pushes the full application natively. No ATS, no partner APIs, no IMAP.

## Why this shape

- **Boards do not expose applicants.** Jobs.cz has no employer API without Teamio; LinkedIn's Apply Connect is for certified ATS partners; only StartupJobs has a webhook for a plain company. What every board does offer is an email to the contact address and, for LinkedIn, an "apply on external website" URL. So the two universal doors are an inbox we own and a URL we own.
- **One inbox, not three integrations.** Gmail forwards by filter; Seznam copies by rule; Jobs.cz and LinkedIn mail the contact address. All land on `jobs+<tag>@asajj.cz`, handled by the Worker's `email()` export (plans/002: Cloudflare wins). No OAuth, no Pub/Sub renewals, no token expiry.
- **The tag is the position.** `jobs+senior-be@`, `/apply/senior-be`, a form field, or the StartupJobs internal position name all resolve to the same `intake_tags` row (role, goal). An unknown tag never starts a run: that is the spend brake against spoofed mail and bots, next to `INTAKE_PER_HOUR_CAP`.
- **Runs stay the same.** The funnel calls the same insert and Workflow create as `POST /api/runs` (extracted into `startRun`); the hiring recipe's `seed_profile` already handles a LinkedIn URL or CV text (plans/006). Nothing in the Workflow changes.

## Flow

```mermaid
flowchart LR
  G[Gmail filter fwd] --> M[jobs+tag@asajj.cz<br/>Email Routing]
  S[Seznam rule copy] --> M
  J[Jobs.cz notification] --> M
  L1[LinkedIn Jobs<br/>apply by email] --> M
  M --> E[worker.email<br/>postal-mime, unpdf]
  F[Google Form<br/>Apps Script] --> FR[POST /api/intake/form<br/>bearer INTAKE_TOKEN]
  L2[LinkedIn Jobs<br/>external apply] --> AP["/apply/&lt;tag&gt;"] --> AR[POST /api/apply<br/>same-origin, honeypot]
  SJ[StartupJobs webhook] --> SR["POST /api/intake/startupjobs/&lt;token&gt;"]
  E & FR & AR & SR --> IN[ingestApplication]
  IN --> A[(applications)]
  IN -- known tag + LinkedIn or CV --> R[startRun via=intake] --> I[(investigations<br/>application_id)]
  A --> Q["/intake queue"]
```

## Statuses

`received` → `run-started` | `unmatched` (unknown tag or sender not allowed) | `incomplete` (no LinkedIn URL, no readable CV) | `capped` (hourly cap). Duplicates by `(source, external_id)` return the first row; nothing is written twice.

## What each board gets

| Board | Setting | Lands as |
|---|---|---|
| StartupJobs | Webhook URL with token; internal position name = tag | `startupjobs`, CV downloaded from `files[0]` |
| Jobs.cz | Contact e-mail `jobs+<tag>@asajj.cz`; apply link `/apply/<tag>` in the ad | `email` or `apply-page` |
| LinkedIn Jobs | "Apply on external website" → `/apply/<tag>`; or receive by email at `jobs+<tag>@` | `apply-page` or `email` |
| Gmail / Seznam inbox | Filter / rule forwarding to `jobs+<tag>@` | `email` |
| Google Form | Apps Script on submit → `/api/intake/form` | `form` |

## Honesty lines kept

- The candidate sees "received", never a run or a report. Outreach stays drafted, never sent (brief).
- CV text becomes a Source like a pasted CV (plans/006): FACT still needs a quote inside the excerpt.
- The intake note records why a run did not start; `/intake` shows it; nothing is silently dropped. Unparsable mail is still forwarded to the human inbox when `INTAKE_FORWARD_TO` is verified.
- Raw mail is not kept; only the CV file (R2, purged with the rest) and the extracted text.

## Evolution

- plans/007 positions: replace `intake_tags` with `positions.tag`; `applications.position_id` already reserved.
- Turnstile on `/apply` when spam appears. Retry endpoint for `capped` rows. DOCX extraction if Jobs.cz test applications show it is common.
