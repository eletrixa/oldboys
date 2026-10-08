# 01 — Connectors research (2026-10-08)

Three research passes (email and forms; job boards; StartupJobs developer docs). Facts with sources; "unverified" where a live test is still needed.

## Gmail
- **Chosen:** a Gmail filter with "Forward to jobs+<tag>@asajj.cz". Gmail sends a confirmation mail to the new address first; our handler forwards everything to `INTAKE_FORWARD_TO`, so the code arrives in the human inbox.
- Gmail API push (`users.watch` → Pub/Sub → HTTPS) works but needs a GCP project, `gmail.readonly`, a push subscription, re-`watch` every 7 days (cron), and an OAuth app in production mode or refresh tokens expire weekly. https://developers.google.com/workspace/gmail/api/guides/push
- Apps Script time trigger polling a label and POSTing JSON is the fallback with no forwarding address (quotas 20k UrlFetch/day consumer). https://developers.google.com/apps-script/guides/services/quotas

## Seznam.cz
- No public API. IMAP `imap.seznam.cz:993`; from Workers only via `cloudflare:sockets` and a pre-release client (`cf-imap`), polled by cron. Rejected. https://o-seznam.cz/napoveda/email/mohlo-by-se-hodit/postovni-programy-a-aplikace/ , https://github.com/Exerra/cf-imap
- **Chosen:** rule "Pošli kopii" (Settings → Pravidla) to `jobs+<tag>@asajj.cz`. A match-all condition is unverified; use "Pro: <the seznam address>". https://www.fakturoid.cz/podpora/parovani/preposilani-emailu-seznam

## Google Forms
- **Chosen:** Apps Script installable `onFormSubmit` trigger, `UrlFetchApp` POST with a bearer. File-upload answers are Drive file ids; the script base64-encodes the blob (50 MB POST limit). https://developers.google.com/apps-script/samples/automations/upload-files
- Forms API `watches` need Pub/Sub, 7-day renewals and a second call for the response; heavier for the same result. https://developers.google.com/workspace/forms/api/reference/rest/v1/forms.watches
- Gotcha: a file-upload question forces respondents to sign in to Google. The hosted apply page avoids that.

## Cloudflare Email Routing / Email Workers
- `email(message, env, ctx)` handler next to `fetch` and `scheduled`; `message.raw` stream, `rawSize`, `forward()`, `setReject()`. Inbound limit 25 MiB. Plus-addressing matches the base rule; catch-all available. Zone must use Cloudflare DNS (asajj.cz does; no MX today). https://developers.cloudflare.com/email-routing/email-workers/runtime-api/ , https://developers.cloudflare.com/email-routing/limits/ , https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/
- OpenNext custom worker already exports extra handlers from `src/worker.ts`. https://opennext.js.org/cloudflare/howtos/custom-worker

## StartupJobs
- Employer API `https://api.startupjobs.cz/company/{offers,applications,applications/{uuid}}`, bearer per company (issuance not documented). Webhook per offer ("Additional options"): full application JSON on each signup (`candidateID`, `offerID` integers, `name`, `email`, `phone`, `linkedin`, `why` HTML, `files[]` URLs, `internalPositionName`, `gdpr_accepted`, `test: true` from the test button). Must answer 200/201/202/204/422 or the webhook is deleted. No signature. https://firmy.startupjobs.cz/en/articles/9506864-startupjobs-dev
- **Chosen:** webhook with a secret path token; CV from `files[0]`; tag from the offer id mapping or the internal position name. The company API is not needed.
- Pricing: credit tiers, no free trial found (unverified current list).

## Jobs.cz / Prace.cz (Alma Career, ex LMC)
- No employer applications API without Teamio (paid ATS; "import reakcí" API is Teamio-facing). Recruitis integrates LMC by hourly XML poll. https://intercom.help/teamio/cs/articles/15107165-import-reakci-uchazecu , https://help.recruitis.io/en/sections/therm/job-portals
- Applications are emailed to the contact address; whether the CV is attached or linked is **unverified** (capture a real notification into the `.eml` fixtures).
- **Chosen:** contact address `jobs+<tag>@asajj.cz`; apply link `/apply/<tag>` in the ad text. Apify actors (e.g. `shahidirfan/Jobs-cz-Scraper`) cover postings only; applicants are never public.
- Price seen: Standard ad about 4,790 CZK (unverified PDF snippet).

## LinkedIn Jobs
- Apply Connect / RSC: partner ATS programme with certification and Recruiter licence; not realistic. https://learn.microsoft.com/en-us/linkedin/talent/apply-connect
- Posting offers native apply, apply by email, or an external website URL (no screening questions on external). One free job per Page at a time; free native applications are capped since July 2025, overflow redirects to the company site. https://100hires.com/how-to-post-a-job-on-linkedin.html
- **Chosen:** external website → `/apply/<tag>`; email fallback to `jobs+<tag>@`.

## ATS as middle layer (rejected)
Recruitis 205–859 EUR/month with position-event webhooks only; Teamio outbound applicant API unverified. Our need is a webhook and a CV; the doors above deliver that for free.
