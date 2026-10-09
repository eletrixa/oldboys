# Candidate intake: operator runbook

Applications arrive by email, from a Google Form, from the hosted apply page or from a StartupJobs webhook. Each one becomes one `applications` row and, when it carries a LinkedIn URL or a readable CV for a known position tag, one research run. Contracts: `specs/intake/`. Decision: `plans/008-intake-connectors/00-SYNTHESIS.md`. This doc covers setup of every door, the smoke loop and troubleshooting.

## Purpose and Rules

```
jobs+<tag>@asajj.cz  (Gmail forward, Seznam copy, Jobs.cz, LinkedIn) -> worker email()  --+
POST /api/intake/form              (Google Form via Apps Script, Bearer INTAKE_TOKEN)   --+
POST /api/apply                    (hosted /apply/<tag>: same-origin, honeypot, IP cap) --+--> ingestApplication --> applications --> run
POST /api/intake/startupjobs/<token>  (StartupJobs webhook)                             --+
```

- The **tag** is the position: `[a-z0-9][a-z0-9-]{1,39}`, one row in `intake_tags` (tag, role, goal, optional company shown on the apply page (migration `0015_intake_company.sql`), optional StartupJobs offer id). It is the plus-address, the apply page path, the Google Form "Position code" and the StartupJobs internal position name. An unknown tag never starts a run.
- Idempotent per `(source, external_id)`: sending the same application twice returns the first row and starts no second run. A repeat that carries other details (another LinkedIn URL, CV file or text) keeps the first send and leaves a note on the row: `resent <time>Z with other details (LinkedIn ..., CV ...), the first send is kept` (only the latest). On the apply page the key is position + email, so this is how a candidate's correction, or someone applying under another person's email, shows up: check the note and contact the address.
- Spend brakes: known tag required, `INTAKE_PER_HOUR_CAP` (default 10) intake runs per hour, on top of the global `RUNS_PER_HOUR_CAP` (20) and the per-run budget of $0.50.
- The candidate never learns a run exists. The apply page and the webhook answer "received"; run ids appear only on `/intake` and in operator routes.
- Statuses: `received` (inserted, not decided; stays here only when something threw: the row's note then says "delivery failed after it was stored; the next delivery resumes it", and the next delivery of the same source resumes it at once; an unmarked one after 5 minutes) -> `run-started` | `unmatched` (unknown or missing tag, sender not allowed) | `incomplete` (no LinkedIn URL and no readable CV text) | `capped`. The `note` column says why.
- Raw mail is not kept. Only the CV file (R2 `intake/<applicationId>/<filename>`, written only for a known tag and an allowed sender, purged with the other raw data) and the extracted text are stored.
- Public data only, outreach drafted never sent, no Art. 9 inference: the brief's hard rules apply to intake runs unchanged.

## Config

**Binding** `APPLY_RATE_LIMIT` (`wrangler.jsonc` `ratelimits`, namespace `1001`): 5 apply-page sends per IP per minute; over it the page says "try again in a moment" (429). Every send can store a row and up to 10 MB in R2, and the hourly cap guards run spend, not storage.

**Wrangler vars** (`wrangler.jsonc`):

| Var | Default | Meaning |
|---|---|---|
| `INTAKE_PER_HOUR_CAP` | `"10"` | Max runs started from applications per rolling hour; over it the application is stored `capped` and the quarter-hour cron starts it later |
| `INTAKE_FORWARD_TO` | `"robert@soulfire.cz"` | Verified Email Routing destination that gets a copy of every inbound mail, including Gmail's forwarding confirmation. Empty = no copy. |
| `INTAKE_FROM_ALLOW` | `""` | Comma list of sender domains or addresses allowed to start runs by email. Empty = any sender. Leave empty until real Gmail/Seznam/Jobs.cz mails have shown which envelope sender they carry; the tag is the main brake. |

**Wrangler secrets** (`pnpm exec wrangler secret put <name>`, only when Robert asks for it in the current task):

| Secret | Used by |
|---|---|
| `INTAKE_TOKEN` | Bearer for `POST /api/intake/form`; also stored as a Script Property in the Apps Script |
| `STARTUPJOBS_WEBHOOK_TOKEN` | Path segment of the StartupJobs webhook URL; treat the URL as a secret |
| `STARTUPJOBS_TOKEN` | Optional. StartupJobs bearer, sent with the CV file download when the file URL is on a startupjobs.cz host (the company API itself is never called) |

Generate a value without printing it, then store it where `RUN_TOKEN` lives (`~/s/oldboys/.env`) so it can be pasted into Apps Script / StartupJobs:

```bash
openssl rand -hex 24   # copy once into ~/s/oldboys/.env as INTAKE_TOKEN=...
pnpm exec wrangler secret put INTAKE_TOKEN
```

**Local `.dev.vars`** (copy from `.dev.vars.example`): `INTAKE_TOKEN`, `STARTUPJOBS_WEBHOOK_TOKEN`, `STARTUPJOBS_TOKEN`, plus `RUN_TOKEN` for the operator routes.

**Migration.** The intake migration (`migrations/0009_intake.sql`, adds `intake_tags`, `applications` and `investigations.application_id`) must be applied to prod D1 before deploying. CI cannot migrate D1; Robert runs `pnpm db:migrate:remote` first.

## Create a position tag

One tag per open position. Any of the three ways works; the UI and the API need `RUN_TOKEN`.

```bash
# UI: https://oldboys.asajj.cz/intake  (Tags section, create form)

# API
curl -X POST https://oldboys.asajj.cz/api/intake/tags \
  -H "Authorization: Bearer $RUN_TOKEN" -H "Content-Type: application/json" \
  -d '{"tag":"senior-be","role":"Senior Backend Engineer","goal":"hiring","startupjobsOfferId":"1234"}'

# SQL (local D1 shown; use --remote for prod)
pnpm exec wrangler d1 execute oldboys --local --command \
  "INSERT INTO intake_tags (tag, role, goal, created_at) VALUES ('senior-be','Senior Backend Engineer','hiring',strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
```

`role` (at most 300 characters) is the role the research run uses. `startupjobsOfferId` is optional and only for StartupJobs. The tag appears everywhere below as `<tag>`.

## Door 1: email (`jobs+<tag>@asajj.cz`)

### Cloudflare Email Routing (done)

- Email Routing is enabled on the `asajj.cz` zone and verified. It uses Cloudflare DNS; Cloudflare added its MX, SPF and DKIM records. The zone had no MX before, so adding a mailbox provider on this domain later would conflict.
- Subaddressing is enabled. Rule `jobs@asajj.cz` -> Worker `oldboys`, plus a catch-all rule to the same Worker.
- The Worker rejects any recipient whose local part is not `jobs` or `jobs+<tag>`; catch-all mail to other addresses bounces "no such address". A mail to `jobs@` with no tag is stored as `unmatched`.
- Destination address for the human copy: `robert@soulfire.cz`, already verified. `INTAKE_FORWARD_TO` is set to it, so every inbound mail is stored and copied there. If the forward ever fails, it is logged and the application is still stored.
- Limits: Cloudflare accepts 25 MiB per message; the Worker rejects anything over 10 MiB with "message too large".

Check the state (dashboard: asajj.cz -> Email -> Email Routing -> Routing rules, Destination addresses, Activity log), or by API:

```bash
curl -s -H "Authorization: Bearer $CF_API_TOKEN" "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/email/routing/rules" | jq '.result[] | {name, enabled, matchers, actions}'
curl -s -H "Authorization: Bearer $CF_API_TOKEN" "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/email/routing/addresses" | jq '.result[] | {email, verified}'
```

### Gmail: forward a mailbox to a position

1. `INTAKE_FORWARD_TO` is already set (above), so the confirmation reaches `robert@soulfire.cz`.
2. Gmail -> Settings (gear) -> See all settings -> **Forwarding and POP/IMAP** -> **Add a forwarding address** -> `jobs+<tag>@asajj.cz` -> Next -> Proceed.
3. Gmail sends a confirmation mail to that address. The Worker stores it as an application (`incomplete`, harmless) and forwards it to `INTAKE_FORWARD_TO`. Open it in `robert@soulfire.cz`, click the link or copy the code back into Gmail's Verify field.
4. Settings -> **Filters and Blocked Addresses** -> **Create a new filter**. Use narrow criteria, for example the sender (`jobs.cz`, `linkedin.com`), a subject phrase, or the alias the ad uses. Next -> tick **Forward it to** -> `jobs+<tag>@asajj.cz` -> Create filter.
5. One forwarding address and one filter per tag. Do not forward the whole mailbox: every forwarded mail with a known tag and a LinkedIn URL or PDF starts a paid run.

### Seznam: copy a mailbox to a position

Seznam has no API; use its rule. Email -> Nastavení -> **Pravidla** -> new rule. Condition: **Pro: `<the seznam address>`** (a match-all condition is unverified). Action: **Pošli kopii** to `jobs+<tag>@asajj.cz`. If Seznam asks to confirm the target address, the confirmation arrives in the `INTAKE_FORWARD_TO` inbox. Whether Seznam accepts a `+` in the target address is unverified: send a test mail and check `/intake`.

### Jobs.cz (and Prace.cz)

In the ad, set the contact address for responses to `jobs+<tag>@asajj.cz` and add `https://oldboys.asajj.cz/apply/<tag>` to the ad text. Jobs.cz has no applications API without the paid Teamio ATS, so applications are mailed to the contact address. Whether the CV arrives attached or as a link is **unverified**: until a real notification is captured, expect `incomplete` unless the mail shows a LinkedIn URL. To capture one: apply to your own ad from a test account, open the copy in `robert@soulfire.cz`, download the original (Gmail: three dots -> Download message) and replace the placeholder `src/domain/__tests__/fixtures/jobs-cz-notification.eml`, removing real personal data.

### LinkedIn Jobs

Post the job and choose **Apply on an external website**, URL `https://oldboys.asajj.cz/apply/<tag>` (wording in the LinkedIn UI varies; no screening questions are possible on external apply). The alternative is the by-email option with `jobs+<tag>@asajj.cz`. LinkedIn's Apply Connect is for certified ATS partners and is not used.

## Door 2: Google Form (Apps Script)

### Form

Create the form in the owner account (the script runs as the owner and reads uploads from the owner's Drive). Question titles are matched case-insensitively, so keep them exactly:

| Title | Type | Required |
|---|---|---|
| Name | Short answer | yes |
| Email | Short answer, response validation: Text -> Email | yes |
| LinkedIn URL | Short answer | no |
| CV | File upload (PDF) | no |
| Cover letter | Paragraph | no |
| Position code | Short answer | yes |

The server needs a LinkedIn URL or a CV, so mark one of them required in the form's description. **Position code** carries the tag: Form -> three dots -> **Get pre-filled link** -> type the tag into Position code -> Get link. Hand out that pre-filled link per position. A file-upload question forces respondents to sign in to Google; for open applications use the apply page (`/apply/<tag>`) instead.

### Script

In the form: three dots -> **Script editor** (Extensions -> Apps Script). Paste this as `Code.gs`. Then **Project Settings -> Script properties -> Add** `INTAKE_TOKEN` with the secret value (never put the token in the code).

```javascript
// Posts each Google Form submission to oldboys: POST /api/intake/form (specs/intake/form.md).
// Titles of the form questions: Name, Email, LinkedIn URL, CV, Cover letter, Position code (optional: Phone).
const ENDPOINT = 'https://oldboys.asajj.cz/api/intake/form';
const DEFAULT_TAG = '';          // used when "Position code" is empty; leave '' to require it
const MAX_CV_BYTES = 6000000;    // server cap is 8,000,000 base64 characters (about 6 MB of file)

function onFormSubmit(e) {
  send_(e.response);
}

// Recovery: re-sends every stored response. Safe, because the response id is the externalId and duplicates are ignored.
function resendAll() {
  FormApp.getActiveForm().getResponses().forEach(send_);
}

// Run once from the editor: installs the form-submit trigger (first run asks for authorization).
function install() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'onFormSubmit')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onFormSubmit').forForm(FormApp.getActiveForm()).onFormSubmit().create();
}

function send_(response) {
  const token = PropertiesService.getScriptProperties().getProperty('INTAKE_TOKEN');
  if (!token) throw new Error('Script property INTAKE_TOKEN is not set');

  const answers = {};
  response.getItemResponses().forEach((ir) => {
    answers[ir.getItem().getTitle().trim().toLowerCase()] = ir.getResponse();
  });
  const text = (title) => {
    const v = answers[title];
    return typeof v === 'string' ? v.trim() : '';
  };

  const payload = { tag: (text('position code') || DEFAULT_TAG).toLowerCase(), externalId: response.getId() };
  const put = (key, value, max) => { if (value) payload[key] = value.slice(0, max); };
  put('name', text('name'), 200);
  put('email', text('email'), 200);
  put('phone', text('phone'), 40);
  put('linkedinUrl', text('linkedin url'), 500);
  put('coverLetter', text('cover letter'), 10000);

  // A file-upload answer is an array of Drive file ids; send the first file.
  const fileIds = answers['cv'];
  if (Array.isArray(fileIds) && fileIds.length > 0) {
    const file = DriveApp.getFileById(fileIds[0]);
    if (file.getSize() <= MAX_CV_BYTES) {
      const blob = file.getBlob();
      payload.cvBase64 = Utilities.base64Encode(blob.getBytes());
      payload.cvFilename = file.getName().slice(0, 200);
      payload.cvContentType = (blob.getContentType() || 'application/pdf').slice(0, 100);
    } else {
      payload.coverLetter = ((payload.coverLetter || '') + '\n[CV file too large to forward: ' + file.getName() + ']').slice(0, 10000);
    }
  }

  const res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('intake form ' + code + ': ' + res.getContentText().slice(0, 300));
  }
}
```

Install the trigger once: select `install` in the editor toolbar -> Run -> Review permissions. Google shows "unverified app" for a personal script: Advanced -> Go to project (unsafe) -> Allow. Check Triggers (clock icon): one `onFormSubmit`, event source From form, event type On form submit. A failed submit throws, so Apps Script lists it under Executions and emails a failure summary; fix the cause, then run `resendAll`.

The endpoint answers 201 `{applicationId, status}` or, for a repeated response id, 200 with `duplicate: true`. It never returns a run id.

## Door 3: hosted apply page

`https://oldboys.asajj.cz/apply/<tag>` (404 for an unknown tag). Public, candidate-facing, no mention of research. Fields: full name, email, LinkedIn URL and/or CV (one is enough), optional message, a hidden honeypot (`hp_contact`) plus the time from page render to Send (`fill_ms`, under 3 s counts as a bot). Title and link preview say "Apply: <role> at <company>" (company from the tag's optional `company`, set in the `/intake` tag form); `?lang=cs` gives the Czech page for the Jobs.cz ad. Under the button: who uses the data, the 7-day deletion and a link to `/apply/<tag>/privacy`. The CV is a PDF, Word `.docx` or `.txt` file up to 10 MB, picked or dropped on one zone; an older `.doc` is kept but not read, so it needs LinkedIn beside it; images are refused on the spot with "Please attach your CV as a PDF, Word or text file.". Fallback: "No file at hand? Paste your CV text" swaps the zone for a textarea (up to 20,000 characters) that is sent as `cvText`; a file wins if both arrive. The kind is taken from the file's bytes when they show one (a `.docx` sent as a PDF is read as Word). Text is read from PDF (`unpdf`), DOCX (`mammoth`) and TXT (UTF-8, UTF-16 with a BOM, or Czech windows-1250; binary junk is refused); a `.docx` or PDF that would inflate past 40 MB (a decompression bomb) is never parsed; a file without readable text (a phone scan) is answered on the spot with "We could not read any text in that PDF. Please add your LinkedIn profile or paste the text of your CV." unless a LinkedIn URL came with it (then it is stored and noted). The upload shows progress and times out only after 90 s without progress, a network error or 5xx offers "Try again" with the form still filled, and the done card says "Received. We'll reply to <email>." with what was attached. One application per email per position: a resubmit is a duplicate (with other details it is noted on the row, see the rules above). The page 404s an unknown tag on purpose (a mistyped link should say so before anyone fills it in), while the API answers an unknown tag like a known one. The page says "Received" only once the application is stored (a capped one too: the cron starts it later); a send that failed after storing marks the row, and Try again resumes it at once; while an earlier send is still being stored it asks to try again. All invalid fields are marked at once, and a double tap sends once. This is the URL for LinkedIn "external website", the Jobs.cz ad text and StartupJobs ad text.

## Door 4: StartupJobs webhook

Facts (StartupJobs developer docs, 2024-07-25): a webhook URL is set per offer; on each application StartupJobs POSTs the full application as JSON; the endpoint must answer 200, 201, 202, 204 or 422, any other status **deletes the webhook**; there is no signature, so the secret lives in the path. The Worker answers only those codes (404 for a wrong token is the single exception and is intended: StartupJobs would delete the webhook, which is the right outcome for a leaked or rotated URL).

1. Set the secret: `pnpm exec wrangler secret put STARTUPJOBS_WEBHOOK_TOKEN` (generate as above). Optional: `STARTUPJOBS_TOKEN`. The StartupJobs company API is **not called**; the webhook payload is the whole application. The only use of `STARTUPJOBS_TOKEN` is the CV file download: it is sent as a bearer when the file URL is on a startupjobs.cz host.
2. Map the offer to a tag, either way:
   - set the offer's **internal position name** to the tag (`senior-be`), or
   - create the tag with `startupjobsOfferId` set to the numeric offer id (the offer id mapping wins when both exist).
3. In the StartupJobs employer admin (`firmy.startupjobs.cz`), open the offer -> **Additional options** -> Webhook URL:
   `https://oldboys.asajj.cz/api/intake/startupjobs/<STARTUPJOBS_WEBHOOK_TOKEN>`
4. Press the **test** button. StartupJobs sends the payload with `"test": true`. Expect HTTP 200 `{"received":true,"test":true}` and a new row on `/intake` with status `unmatched` and the note "StartupJobs test payload". Nothing is downloaded and no run starts.
5. The CV is the first `files[]` entry ending in `.pdf`. A failed download never fails the webhook; the row becomes `incomplete` unless the payload carries a LinkedIn URL.

Rotate the token by putting a new secret value and pasting the new URL into every offer.

## Smoke loop

Order: tag exists -> endpoint answers -> row on `/intake` -> status as expected. A known tag plus a LinkedIn URL or CV **starts a real run that spends up to $0.50** (recorded in the run's ledger). For spend-free smokes use an unknown tag (`unmatched`) or send neither LinkedIn nor CV (`incomplete`).

Local: `pnpm db:migrate:local`, `pnpm dev` (Next on `http://localhost:3141`, secrets from `.dev.vars`). Production: replace the host with `https://oldboys.asajj.cz` and the secrets with the real ones.

```bash
H=http://localhost:3141

# Form (Bearer INTAKE_TOKEN). 201 {applicationId,status}; repeat -> 200 {duplicate:true}
curl -i -X POST $H/api/intake/form \
  -H "Authorization: Bearer $INTAKE_TOKEN" -H "Content-Type: application/json" \
  -d '{"tag":"nosuchtag","externalId":"smoke-1","name":"Test Candidate","email":"test@example.com","linkedinUrl":"https://www.linkedin.com/in/example-candidate"}'

# Form with a CV
curl -i -X POST $H/api/intake/form \
  -H "Authorization: Bearer $INTAKE_TOKEN" -H "Content-Type: application/json" \
  -d "{\"tag\":\"senior-be\",\"externalId\":\"smoke-2\",\"name\":\"Test Candidate\",\"cvBase64\":\"$(base64 -w0 cv.pdf)\",\"cvFilename\":\"cv.pdf\"}"

# Apply page endpoint (same-origin check needs these headers; honeypot hp_contact stays empty, fill_ms >= 3000). 201 {received:true}
curl -i -X POST $H/api/apply \
  -H "Origin: $H" -H "Sec-Fetch-Site: same-origin" \
  -F tag=nosuchtag -F name='Test Candidate' -F email=test@example.com \
  -F linkedinUrl=https://www.linkedin.com/in/example-candidate -F coverLetter='Hello' -F hp_contact= -F fill_ms=5000

# Apply page with a PDF
curl -i -X POST $H/api/apply \
  -H "Origin: $H" -H "Sec-Fetch-Site: same-origin" \
  -F tag=senior-be -F name='Test Candidate' -F email=test@example.com -F 'cv=@cv.pdf;type=application/pdf' -F hp_contact= -F fill_ms=5000

# StartupJobs webhook, test payload (no tag -> unmatched, 200 {received:true,test:true})
curl -i -X POST "$H/api/intake/startupjobs/$STARTUPJOBS_WEBHOOK_TOKEN" -H "Content-Type: application/json" \
  -d '{"date":"2026-10-09T10:00:00+02:00","candidateID":1,"offerID":1234,"name":"Test Candidate","position":"Senior Backend Engineer","email":"test@example.com","linkedin":"https://linkedin.com/in/example-candidate","files":[],"gdpr_accepted":true,"test":true}'

# StartupJobs webhook, real-shaped payload (tag from offer id mapping or internalPositionName)
curl -i -X POST "$H/api/intake/startupjobs/$STARTUPJOBS_WEBHOOK_TOKEN" -H "Content-Type: application/json" \
  -d '{"date":"2026-10-09T10:00:00+02:00","candidateID":2,"offerID":1234,"name":"Test Candidate","position":"Senior Backend Engineer","why":"<p>Hello</p>","email":"test@example.com","linkedin":"https://linkedin.com/in/example-candidate","internalPositionName":"senior-be","files":[],"gdpr_accepted":true}'

# Operator: queue and tags (Bearer RUN_TOKEN)
curl -s $H/api/intake/applications -H "Authorization: Bearer $RUN_TOKEN" | jq '.[0:5]'
curl -s $H/api/intake/tags -H "Authorization: Bearer $RUN_TOKEN"
```

**Email, local.** The `email()` handler runs only in the Workers runtime, not under `pnpm dev`. Build and serve the Worker, then post a fixture through Wrangler's email handler (port 8787):

```bash
pnpm exec opennextjs-cloudflare build
pnpm exec wrangler dev        # second terminal below

curl -X POST 'http://localhost:8787/cdn-cgi/handler/email?from=a@b.cz&to=jobs%2Bsenior-be@asajj.cz' \
  --data-binary @src/domain/__tests__/fixtures/gmail-forward.eml -H 'Content-Type: message/rfc822'
```

That fixture carries a LinkedIn URL and a PDF, so with the tag `senior-be` present it starts a run. Other fixtures: `seznam-copy.eml` (plain text, Czech diacritics), `jobs-cz-notification.eml` (HTML only, `incomplete`), `no-tag.eml` (`unmatched`). Use `to=jobs%2Bnosuchtag@asajj.cz` (the plus must be URL-encoded in the query, or wrangler reads it as a space and the Worker answers "no such address") for a spend-free check.

**Email, production.** Send a real mail from any address to `jobs+<tag>@asajj.cz`, then:

```bash
pnpm exec wrangler tail oldboys      # look for: intake email <applicationId> <status>
curl -s https://oldboys.asajj.cz/api/intake/applications -H "Authorization: Bearer $RUN_TOKEN" | jq '.[0]'
```

Also check the Cloudflare dashboard Activity log under Email Routing: it shows delivered, rejected and forwarded mail per message.

## Production state (2026-10-09)

Done by the rollout, so nobody repeats it: Worker secrets `INTAKE_TOKEN` and `STARTUPJOBS_WEBHOOK_TOKEN` are set (values in `~/s/oldboys/.env`, next to `RUN_TOKEN`); `STARTUPJOBS_TOKEN` is not set (only needed when StartupJobs file downloads answer 401/403). Tags `cmo` ("CMO") and `ux-designer` ("UX designer") exist, so `https://oldboys.asajj.cz/apply/cmo`, `/apply/ux-designer`, `jobs+cmo@asajj.cz` and `jobs+ux-designer@asajj.cz` are live. Verified in production with spend-free payloads: form 201/401, StartupJobs test payload 200 and wrong token 404, apply cross-origin 403, and a real mail from `zoraone@agentmail.to` to `jobs+nosuchtag@asajj.cz` stored `unmatched` within seconds (Email Routing, MX and the Worker `email` export all work). The StartupJobs webhook URL is `https://oldboys.asajj.cz/api/intake/startupjobs/<STARTUPJOBS_WEBHOOK_TOKEN>`.

Still manual, per section: Gmail filter and Seznam rule on the mailbox that receives board mail, the Google Form and its Apps Script trigger, the webhook URL in each StartupJobs offer, the apply link in LinkedIn and Jobs.cz postings, and one real application per board to capture its mail shape into `src/domain/__tests__/fixtures/`.

## Troubleshooting

| Symptom (status) | Cause | Fix |
|---|---|---|
| Form endpoint 503, message names `INTAKE_TOKEN` | Secret not set on the Worker | `pnpm exec wrangler secret put INTAKE_TOKEN` |
| Form endpoint 401 | Script Property differs from the Worker secret | Re-paste the token into Script properties, no trailing space |
| Form endpoint 400 "send linkedinUrl, cvText or cvBase64" | Respondent gave neither LinkedIn nor CV, or the CV was over 6 MB and was dropped by the script | Make one field required in the form; ask for a link or the apply page |
| Form endpoint 400 on base64 or fields | Field over its cap, malformed email | Read the response body in Apps Script Executions; fix the form validation |
| Apps Script execution failed | Any non-200/201 answer throws | Fix the cause, run `resendAll` (duplicates are ignored) |
| Apply endpoint 403 | Request lacks same-origin `Origin` / `Sec-Fetch-Site`, or comes from another site | Use the hosted page, or add the two headers for curl |
| Apply endpoint 200 `{received:true}` but no row | Honeypot `hp_contact` was filled, or `fill_ms` was missing or under 3000 (bot) | Expected; our page shows "try again" for a 200 and clears the honeypot, so a person is never told an unstored send arrived |
| Apply endpoint 429 | More than 5 sends from one IP within a minute (`APPLY_RATE_LIMIT`) | Nothing for a person (the page asks to try again in a moment); a burst from one IP is a script |
| Apply endpoint 400 "We could not read that form" | No `Content-Length` (a chunked body) or an unparsable body | Browsers and `curl -F` always send one; a script must too |
| Apply endpoint 503 | An earlier send of the same application is still being stored, or a racing retry won the resume | Nothing: the candidate's Try again gets 201 once it is stored |
| Apply page 500 under `next dev` | `next dev` has no Workflow binding (`env.RESEARCH_RUN.create` is undefined), so every run start throws | Expected locally; to reach `run-started` run `pnpm exec opennextjs-cloudflare build` then `pnpm exec wrangler dev --port <port>` (no hot reload). Repeated local QA hits the hourly cap: `UPDATE investigations SET created_at='2026-01-01T00:00:00.000Z' WHERE via='intake'` on the local D1 |
| `/apply/<tag>` 404 | Tag not in `intake_tags` or invalid | Create the tag |
| StartupJobs webhook deleted by StartupJobs | The URL once answered something other than 200/201/202/204/422 (wrong token gives 404) | Re-enter the correct URL in the offer; check the token |
| Webhook 503 | `STARTUPJOBS_WEBHOOK_TOKEN` not set | `wrangler secret put STARTUPJOBS_WEBHOOK_TOKEN` |
| Webhook 202 `{received:false}` | The funnel threw; the row, if created, stays `received`. StartupJobs does not redeliver, so the raw body was kept at R2 `intake/dead-letter/startupjobs/<time>-<candidateID>.json` | `wrangler tail oldboys`, fix the cause, then re-POST the kept body to the webhook URL: `pnpm exec wrangler r2 object get oldboys-sources/intake/dead-letter/startupjobs/<file> --file /tmp/dl.json` and `curl -X POST .../api/intake/startupjobs/<token> -H 'content-type: application/json' --data-binary @/tmp/dl.json` (after 5 minutes the `received` row is resumed, see below) |
| Webhook 422 | Body is not the documented payload | Compare with `specs/intake/startupjobs.md`; StartupJobs stops retrying |
| `unmatched`, note "unknown tag" | Plus-address, position code or internal position name matches no `intake_tags` row | Create the tag, or correct the address/offer mapping; then re-send the source |
| `unmatched`, note "sender not allowed" | `INTAKE_FROM_ALLOW` excludes the envelope sender | Add the domain/address or empty the var, deploy, re-send |
| `unmatched` with no tag (`jobs@`) | Mail sent to the base address | Use `jobs+<tag>@` |
| `incomplete`, note "PDF has no extractable text" | Scanned PDF | Ask for a text CV or LinkedIn URL; or start the run by hand from the start form |
| `incomplete`, note "unsupported CV format" | DOCX or other format (stored in R2, not parsed) | Same as above |
| `incomplete`, note "cv download failed <status>" | StartupJobs file URL needs auth or expired | Set `STARTUPJOBS_TOKEN`; or fetch the file from the application's admin page |
| `incomplete` for Jobs.cz mails | The notification links the CV instead of attaching it | Put the apply page link in the ad; capture a real mail into the fixture |
| `capped` | `INTAKE_PER_HOUR_CAP` reached when the application arrived | Nothing: the `*/15 * * * *` cron re-decides capped rows oldest first and starts their runs once the hour has room (a re-delivery does the same at once). Raise the cap if the queue grows |
| `received` that never moves | R2, D1 or Workflow create threw after the insert | `wrangler tail oldboys`, fix the cause, then re-send the source (forward the mail again, `resendAll` in Apps Script, resubmit the apply page, re-POST the StartupJobs dead letter): a `received` row older than 5 minutes is processed again from the new delivery, and a run the failed attempt had already started is linked, not started twice |
| No row for a sent mail | Mail never reached the Worker: wrong address, recipient rejected, destination or rule disabled, over 10 MiB | Email Routing Activity log; rule `jobs@` and catch-all point to Worker `oldboys`; recipient must be `jobs@` or `jobs+<tag>@` |
| Gmail "forwarding address" confirmation never arrives | `INTAKE_FORWARD_TO` was emptied, or the destination was removed in Email Routing | Restore the var and deploy, check Destination addresses shows `robert@soulfire.cz` verified, resend the confirmation |
| Log line "forward failed" | Destination removed or unverified | Verify it in Email Routing -> Destination addresses; the application was stored anyway |
| Seznam copy never arrives | Rule condition does not match, or `+` target refused | Test with a mail to the exact seznam address; if `+` is refused, a copy to plain `jobs@` is stored as `unmatched`, so give the candidates the apply page link instead |
| Migration errors "no such table: applications" | `0009_intake.sql` not applied to this D1 | `pnpm db:migrate:local` / Robert runs `pnpm db:migrate:remote` |
