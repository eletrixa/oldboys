# Unit: StartupJobs connector (`POST /api/intake/startupjobs/<token>`)

Facts (docs 2024-07-25, https://firmy.startupjobs.cz/en/articles/9506864-startupjobs-dev): a webhook URL is set per offer under "Additional options"; on each application StartupJobs POSTs the **full application** as JSON; the endpoint must answer 200/201/202/204 or 422, any other code **deletes the webhook**. No signature. A test button sends the same payload with `"test": true`. Payload:

```json
{ "date": "2017-09-11T18:19:15+02:00", "candidateID": 12345, "offerID": 1234, "name": "Pan Žralok",
  "position": "Vývojář webhooků", "why": "<p>…</p>", "phone": "+420 …", "email": "dev@startupjobs.cz",
  "details": "https://www.startupjobs.cz/admin/…", "linkedin": "https://linkedin.com/in/…",
  "internalPositionName": "JOB1", "files": ["https://www.startupjobs.cz/download/file.pdf"], "gdpr_accepted": true, "test": true? }
```
The company API (`GET https://api.startupjobs.cz/company/applications`, bearer per company) uses UUIDs that the webhook does not carry; it is **not used** in this unit.

## Files
- `src/app/api/intake/startupjobs/[token]/route.ts` (thin) + `src/app/api/intake/startupjobs/handler.ts` + `src/app/api/intake/__tests__/startupjobs.test.ts`
- `src/domain/startupjobs.ts` (payload schema + mapping, pure) + `src/domain/__tests__/startupjobs.test.ts`

## `domain/startupjobs.ts`
```ts
export const StartupJobsWebhook = z.looseObject({ candidateID: z.coerce.number().int(), offerID: z.coerce.number().int(), name, email, phone, why, linkedin, position, internalPositionName, files: z.array(z.string()).nullish() /* -> [] */, test: z.boolean().nullish() });
export function toIntakeInput(p: StartupJobsWebhook, tag: string | undefined, cv?: CvFile): IntakeInput
  // source "startupjobs"; externalId `${offerID}:${candidateID}` (`test:` prefix on a test payload); coverLetter = htmlToText(why) (src/domain/html-text.ts); note "startupjobs offer <offerID> <position>"; test → note "StartupJobs test payload"
export function tagFor(p, byOfferId?: string): string | undefined  // offer id mapping wins; else internalPositionName (trimmed, lower-cased) when it validates as IntakeTag
```
Optional fields are `nullish` (a real payload may send `null` for an absent phone or LinkedIn, and a 422 would lose the application). `toIntakeInput` never produces something the funnel's own `IntakeInput.parse` rejects: blank fields are dropped, over-long ones truncated, an invalid email is dropped with the note "invalid email". The `test:` prefix keeps a test payload from shadowing a real application with the same ids.

## Handler
```ts
export type StartupJobsEnv = IntakeEnv & { STARTUPJOBS_WEBHOOK_TOKEN?: string; STARTUPJOBS_TOKEN?: string };
export async function handleStartupJobsWebhook(request: Request, token: string, env: StartupJobsEnv, now: Date, fetchImpl = fetch): Promise<Response>
```
1. `STARTUPJOBS_WEBHOOK_TOKEN` unset → 503 (the only 5xx, reachable only while no valid webhook URL can exist); `!timingSafeEqual(token, secret)` → 404 (not 401: do not confirm the route exists).
2. Body JSON + `StartupJobsWebhook.safeParse` → 422 `{error}` (keeps the webhook alive, StartupJobs stops retrying).
3. `test === true` → `ingestApplication` with no tag so it lands as `unmatched` with the note "unknown tag; StartupJobs test payload", 200 `{received: true, test: true}`. No download.
4. Tag: `SELECT tag FROM intake_tags WHERE startupjobs_offer_id = ?` (offerID as text) → else `internalPositionName`. The lookup and the download of step 5 run in parallel (`Promise.all`); the CV note is joined onto the application note with `joinNotes`.
5. First `files[]` entry whose URL path ends `.pdf` (case-insensitive): `fetchImpl(url)` with a 15 s timeout, https only; when `STARTUPJOBS_TOKEN` is set **and the host is `startupjobs.cz` or a subdomain**, the first request already carries `Authorization: Bearer ${STARTUPJOBS_TOKEN}` (no 401/403 retry; the file URL comes from the payload, so the bearer never goes to another host); ≤ `CV_MAX_BYTES` (10 MiB); the file becomes a CvFile via `toCvFile`; any failure → no cv, note "cv download failed <status or reason>". Files without a PDF → note "no PDF among N files". Never fail the webhook over the file.
6. `ingestApplication(toIntakeInput(...), env, now)` → 200 `{received: true}` (duplicate also 200). An unexpected throw → 500 is **not acceptable** (webhook deletion): catch, log, answer 202 `{received: false}` so StartupJobs keeps the webhook; the application row, if any, stays `received` and shows on `/intake`.

## Ops (goes into `docs/ops/intake.md`)
Webhook URL `https://oldboys.asajj.cz/api/intake/startupjobs/<STARTUPJOBS_WEBHOOK_TOKEN>`; set the offer's internal position name to the tag, or insert the offer id into `intake_tags.startupjobs_offer_id`; press the test button and expect a row on `/intake` with the test note.

## Tests
- domain: schema accepts the documented payload and the test payload, coerces string ids; `toIntakeInput` fields; `tagFor` precedence.
- handler: 503, 404 wrong token, 422 bad body, test payload → 200 + unmatched row, happy path with fake fetch returning a PDF → R2 put + run, bearer on the first request to a startupjobs.cz host and never elsewhere, a 403 is a note and not retried, download failure → still 200 and `incomplete` unless LinkedIn present, funnel throw → 202.
