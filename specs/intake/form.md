# Unit: form connector (`POST /api/intake/form`, Google Forms via Apps Script)

## Files
- `src/app/api/intake/form/route.ts` (thin) + `src/app/api/intake/form/handler.ts` + `src/app/api/intake/__tests__/form.test.ts`
- `src/app/api/_lib/intake-body.ts` (Zod body, shared with /api/apply) + `src/app/api/_lib/__tests__/intake-body.test.ts`
- `src/app/api/_lib/auth.ts` (modified: `requireBearer(request, token, name = "RUN_TOKEN")` so the 503 message names the right secret) + `src/app/api/_lib/__tests__/auth.test.ts`

## Body (`IntakeFormBody`)
```ts
{ tag: IntakeTag (trimmed, lowercased first), externalId: string(1..300), name?: string(1..200), email?: z.email(), phone?: string(3..40), linkedinUrl?: string(≤500),
  cvText?: string(1..CV_MAX), cvBase64?: string(≤ 8_000_000 chars ≈ 6 MB), cvFilename?: string(1..200), cvContentType?: string(≤100), coverLetter?: string(1..10000) }
```
At least one of `linkedinUrl`, `cvText`, `cvBase64`; otherwise 400 "send linkedinUrl, cvText or cvBase64". `cvBase64` decodes (standard or url-safe) to `cv.bytes`; a decode failure is 400. Default `cvFilename` "cv.pdf", `cvContentType` "application/pdf".

`IntakeFormBody` is the validating schema; its output replaces the three `cv*` upload fields with `cv?: CvFile` (`{bytes, filename, contentType}`) and has no `source`, so a connector spreads it into `IntakeInput` after adding its own source. Field limits match `IntakeInput`, so the funnel's own parse cannot fail on a validated body.

## Handler
```ts
export type FormIntakeEnv = IntakeEnv & { INTAKE_TOKEN?: string };
export async function handleFormIntake(request: Request, env: FormIntakeEnv, now: Date): Promise<Response>
```
1. `requireBearer(request, env.INTAKE_TOKEN, "INTAKE_TOKEN")` → 503 unset, 401 wrong.
2. `parseJsonBody(request, IntakeFormBody)` → 400.
3. `ingestApplication({ source: "form", ...mapped }, env, now)`.
4. Duplicate → 200 `{ applicationId, status, duplicate: true }`; else 201 `{ applicationId, status }`. **Never return `runId`** (the token holder is the form owner, not an operator; runs are visible on `/intake`).
5. A funnel exception is logged and answers 500 `{ error: "intake failed" }` (no internals); the Apps Script throws on it and `resendAll` re-sends, the duplicate rule making that safe.

## Apps Script (ships in `docs/ops/intake.md`, not in `src/`)
Form fields: Name, Email, LinkedIn URL, CV (file upload, optional), Cover letter; a hidden-ish short-answer "Position code" pre-filled via the form's pre-filled link with the tag. `onFormSubmit(e)` reads `e.response.getItemResponses()` by title, `getId()` of the response as `externalId`, base64 of the first uploaded file blob, and POSTs with `Authorization: Bearer <INTAKE_TOKEN>` to `https://oldboys.asajj.cz/api/intake/form`. Trigger installed once from the script editor (form-submit, installable).

## Tests (`form.test.ts`, fakes as in `elevenlabs.test.ts`)
- 503 without secret, 401 wrong bearer (RUN_TOKEN is not accepted), 400 invalid JSON, 400 missing candidate fields, 400 bad base64.
- 201 with linkedinUrl only → application + run; 201 with cvBase64 → R2 put with decoded bytes; second identical externalId → 200 duplicate, one run; unknown tag → 201 `unmatched`, no run; funnel throw → 500; no response ever contains `runId`.
- `intake-body.test.ts`: defaults, base64 variants (url-safe, unpadded, line breaks), size cap. `auth.test.ts`: default and custom secret name in the 503.
