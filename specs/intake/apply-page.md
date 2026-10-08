# Unit: hosted apply page (`/apply/<tag>` + `POST /api/apply`)

The URL we put into LinkedIn Jobs "apply on external website", Jobs.cz and StartupJobs ad text. Public, candidate-facing: calm, short, no mention of research.

## Files
- `src/app/apply/[tag]/page.tsx` (server), `src/app/apply/[tag]/apply-form.tsx` (client), `src/app/apply/[tag]/__tests__/apply-fields.test.ts` for any pure helper (client validation lives in `apply-fields.ts`)
- `src/app/api/apply/route.ts` (thin) + `src/app/api/apply/handler.ts` + `src/app/api/apply/__tests__/apply.test.ts`

## Page
- `params.tag` → `IntakeTag.safeParse`; `SELECT role FROM intake_tags WHERE tag = ?` via `getCloudflareContext()`; miss → `notFound()`.
- Heading: the role; sub copy: "Leave your LinkedIn profile or CV. We read it and reply by email." Fields: Full name (required), Email (required), LinkedIn URL (optional), CV PDF (optional, ≤ 10 MB, the domain `CV_MAX_BYTES`), Message (optional textarea), honeypot `website` (visually hidden, `tabIndex=-1`, `autoComplete="off"`). Client rule: LinkedIn URL or CV required; a LinkedIn URL that `normalizeLinkedinProfile` rejects is an error (otherwise the funnel would store `incomplete` and the candidate would still see "Received"). All rules live in `apply-fields.ts` (`checkApply`, humane texts in `MESSAGES`); the handler runs the same function.
- Submit: `multipart/form-data` to `/api/apply` (`fetch` with `FormData`, tag in the form body). 201/200 → thank-you state "Received. We'll be in touch." 429 → "Too many applications right now, try again in an hour." 400 → the handler's own sentence; other → inline humane error. Styling follows `src/app/start-form.tsx` (`FIELD` classes, zinc/teal palette, no emoji).

## Handler
```ts
export async function handleApply(request: Request, env: IntakeEnv, now: Date): Promise<Response>
```
1. `fromOurPage(request)` (move the helper from `src/app/api/start/route.ts` into `src/app/api/_lib/origin.ts`; `/api/start` imports it) → 403.
2. A declared `Content-Length` over CV limit + 256 KiB → 400 before buffering. `request.formData()` (parse failure → 400); `website` non-empty → 200 `{received: true}` (silent drop; nothing stored).
3. Validate (`checkApply` once; it owns the `z.email()` check): `tag` IntakeTag, `name` 1..200, `email` z.email, `linkedinUrl` ≤ 500 optional and a valid LinkedIn profile URL, `coverLetter` ≤ 10000 optional, `cv` File optional: size ≤ 10 MiB (`CV_MAX_BYTES`), type `application/pdf` or name `.pdf` → else 400 `{error}`. LinkedIn or CV required → 400.
4. `externalId = sha256Hex(`${tag}|${email.toLowerCase()}`)` (one application per email per position; a resubmit is a duplicate).
5. `ingestApplication({ source: "apply-page", ... }, env, now)`.
6. Response: `capped` (new or resubmitted) → 429 `{error: "too many applications"}`; anything else (including duplicate, unmatched, incomplete) → **201** `{received: true}`, the same code for a duplicate so the status cannot reveal that an email already applied (the honeypot is the only 200). A funnel failure → 500 `{error}` with a plain sentence, details to `console.error` only. Never return applicationId, status or runId.

**Known gap (funnel, not this unit):** a `capped` row is idempotent like any other, so a candidate who retries after the hour gets 429 again and no run starts. The funnel should re-evaluate a `capped` duplicate (or the operator UI must re-run it).

## Tests (`apply.test.ts`)
- 403 wrong origin; honeypot → 200 and no D1 write; 400 bad tag / missing name / bad email / not a LinkedIn link / non-PDF / > 10 MiB / long message / oversized Content-Length; 201 with LinkedIn only; 201 with PDF → R2 put; duplicate → 201 `{received:true}` and no second run; unknown tag → 201 stored `unmatched`; capped → 429; funnel failure → 500 without detail; no success body ever differs from `{"received":true}`.
- `apply-fields.test.ts` covers `checkApply` (PDF detection is the domain `isPdf`, tested in `digest.test.ts`); `_lib/__tests__/origin.test.ts` covers `fromOurPage`.
- Build a multipart `Request` with `FormData` + `File` in Node (undici globals in Node 22+).
