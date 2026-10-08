# Unit: hosted apply page (`/apply/<tag>` + `POST /api/apply`)

The URL we put into LinkedIn Jobs "apply on external website", Jobs.cz and StartupJobs ad text. Public, candidate-facing: calm, short, no mention of research.

## Files
- `src/app/apply/[tag]/page.tsx` (server), `src/app/apply/[tag]/apply-form.tsx` (client), `src/app/apply/[tag]/__tests__/apply-fields.test.ts` for any pure helper (client validation lives in `apply-fields.ts`)
- `src/app/api/apply/route.ts` (thin) + `src/app/api/apply/handler.ts` + `src/app/api/apply/__tests__/apply.test.ts`

## Page
- `params.tag` → `IntakeTag.safeParse`; `SELECT role FROM intake_tags WHERE tag = ?` via `getCloudflareContext()`; miss → `notFound()`.
- Heading: the role; sub copy: "Leave your LinkedIn profile or CV. We read it and reply by email." Fields: Full name (required), Email (required), LinkedIn URL (optional), CV PDF (optional, ≤ 5 MB), Message (optional textarea), honeypot `website` (visually hidden, `tabIndex=-1`, `autoComplete="off"`). Client rule: LinkedIn URL or CV required.
- Submit: `multipart/form-data` to `/api/apply` (`fetch` with `FormData`). 201/200 → thank-you state "Received. We'll be in touch." 429 → "Too many applications right now, try again in an hour." Other → inline humane error. Styling follows `src/app/start-form.tsx` (`FIELD` classes, zinc/teal palette, no emoji).

## Handler
```ts
export type ApplyEnv = IntakeEnv;
export async function handleApply(request: Request, env: ApplyEnv, now: Date): Promise<Response>
```
1. `fromOurPage(request)` (move the helper from `src/app/api/start/route.ts` into `src/app/api/_lib/origin.ts`; `/api/start` imports it) → 403.
2. `request.formData()`; `website` non-empty → 200 `{received: true}` (silent drop; nothing stored).
3. Validate: `tag` IntakeTag, `name` 1..200, `email` z.email, `linkedinUrl` ≤ 500 optional, `coverLetter` ≤ 10000 optional, `cv` File optional: size ≤ 5 MiB, type `application/pdf` or name `.pdf` → else 400 `{error}`. LinkedIn or CV required → 400.
4. `externalId = sha256hex(`${tag}|${email.toLowerCase()}`)` (one application per email per position; a resubmit is a duplicate).
5. `ingestApplication({ source: "apply-page", ... }, env, now)`.
6. Response: `capped` → 429 `{error: "too many applications"}`; anything else (including duplicate, unmatched, incomplete) → 201/200 `{received: true}`. Never return applicationId, status or runId.

## Tests (`apply.test.ts`)
- 403 wrong origin; honeypot → 200 and no D1 write; 400 bad tag / missing name / bad email / non-PDF / > 5 MiB; 201 with LinkedIn only; 201 with PDF → R2 put; duplicate → 200 `{received:true}` and no second run; capped → 429.
- Build a multipart `Request` with `FormData` + `File` in Node (undici globals in Node 22+).
