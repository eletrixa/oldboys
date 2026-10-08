# Unit: hosted apply page (`/apply/<tag>` + `POST /api/apply`)

The URL we put into LinkedIn Jobs "apply on external website", Jobs.cz and StartupJobs ad text. Public, candidate-facing: calm, short, no mention of research.

## Files
- `src/app/apply/[tag]/page.tsx` (server), `src/app/apply/[tag]/apply-form.tsx` (client; `cv-field.tsx` for the uploader), `src/app/apply/[tag]/__tests__/apply-fields.test.ts` for the pure helpers (client validation lives in `apply-fields.ts`); `src/domain/cv-text.ts` + `src/domain/__tests__/cv-text.test.ts` (DOCX); `package.json`: `mammoth`
- `src/app/api/apply/route.ts` (thin) + `src/app/api/apply/handler.ts` + `src/app/api/apply/__tests__/apply.test.ts`

## Page
- `params.tag` → `IntakeTag.safeParse`; `SELECT role FROM intake_tags WHERE tag = ?` via `getCloudflareContext()`; miss → `notFound()`.
- Heading: the role; sub copy: "Leave your LinkedIn profile or CV. We read it and reply by email." Fields: Full name (required), Email (required), LinkedIn URL (optional), CV (optional, see "CV uploader"), Message (optional textarea), honeypot `website` (visually hidden, `tabIndex=-1`, `autoComplete="off"`). Client rule: LinkedIn URL or a CV (file or pasted text) required; a LinkedIn URL that `normalizeLinkedinProfile` rejects is an error (otherwise the funnel would store `incomplete` and the candidate would still see "Received"). All rules live in `apply-fields.ts` (`checkApply`, humane texts in `MESSAGES`); the handler runs the same function.
- Styling: Radar tokens only (`docs/design/radar-ui.md`, classes from `src/app/ui.tsx`: `FIELD`, `BTN_PRIMARY`, `BTN_SECONDARY`, `CARD`, `LINK`); never `zinc-*`/`teal-*`; no emoji; the header and footer stay hidden (site-chrome). Phone first: 16px gutters, every control ≥ 44px tall, no horizontal scroll at 360px.

## CV uploader ("just works")
The one component candidates fight with elsewhere, so it is specified in detail. Client in `apply-form.tsx` (plus a small `cv-field.tsx` if the form file would pass 150 lines), pure helpers in `apply-fields.ts`.
- **Formats**: PDF, Word (`.docx`) and plain text (`.txt`), up to 10 MB (`CV_MAX_BYTES`). Accepted by extension or media type (`isCvFile` in `apply-fields.ts`, built on the domain `cvKind`); `.doc`, images, scans of pictures etc. get the sentence "Please attach your CV as a PDF, Word (.docx) or text file." The `<input type=file accept>` lists exactly those three.
- **Picking**: a drop zone that is also the browse button (one `<button type=button>` labelled "Choose a file or drop it here", keyboard reachable, `aria-describedby` the format/size line) wrapping a visually hidden file input; drag-and-drop on the zone (`dragenter/dragover/dragleave/drop`, highlighted while a file is over it, `prefers-reduced-motion` respected). Dropping or picking a second file replaces the first. A chosen file is shown as a row: name, size ("1.2 MB"), kind, and a "Remove" button (≥ 44px). Type and size are checked the moment the file is chosen, inline under the zone, before anything is sent.
- **Paste instead**: a quiet toggle "No file at hand? Paste your CV text" reveals a textarea (`cvText`, ≤ 20 000 chars, `CV_MAX`), hides the zone (and the other way round); whichever is used is sent, a file wins if both exist.
- **Sending**: `XMLHttpRequest` (not `fetch`: it has no upload progress) posting the multipart body; a progress bar (`role=progressbar`, aria-valuenow) under the button with "Uploading 43%", then "Checking your CV" after 100% until the response; the button reads "Sending…" and is disabled; the form stays filled. Timeout 90 s. On a network error or 5xx: the error sentence plus a "Try again" button that resubmits the same draft; nothing is cleared.
- **Done**: `role=status` card "Received. We'll reply to <email>." with one line that names what was attached ("Your CV: jana-cv.pdf" / "Your LinkedIn profile") and "You can close this page." No run, id or status ever reaches the candidate. 429 → "Too many applications right now, try again in an hour." 400 → the handler's own sentence.
- **Errors**: one `role=alert` region; the first invalid field gets focus; never a browser-native validation popup (`noValidate`).

## Server
- `cvText` form field accepted (≤ `CV_MAX`), mapped to `IntakeInput.cvText`; a file and text together → the file is stored and the text ignored (`cvText` only used when there is no file).
- `isCvFile` in `checkApply` mirrors the formats above; the handler runs the same check (400 with the same sentence).
- `src/domain/cv-text.ts`: `cvKind(file) → "pdf" | "docx" | "txt" | null` by media type or extension; DOCX text via `mammoth` (`extractRawText({ arrayBuffer })`, whitespace-collapsed, ≤ `CV_MAX`), bytes must start with the ZIP magic `PK`; a library error or empty text becomes a note like the PDF path ("Word file has no readable text", "Word file could not be read: …"). The funnel is unchanged.

## Handler
```ts
export async function handleApply(request: Request, env: IntakeEnv, now: Date): Promise<Response>
```
1. `rejectCrossOrigin(request)` from `src/app/api/_lib/same-origin.ts` (the shared browser check from plan 009: Sec-Fetch-Site same-origin and Origin matching Host) → 403 `{error: "browser only"}`.
2. A declared `Content-Length` over CV limit + 256 KiB → 400 before buffering. `request.formData()` (parse failure → 400); `website` non-empty → 200 `{received: true}` (silent drop; nothing stored).
3. Validate (`checkApply` once; it owns the `z.email()` check): `tag` IntakeTag, `name` 1..200, `email` z.email, `linkedinUrl` ≤ 500 optional and a valid LinkedIn profile URL, `coverLetter` ≤ 10000 optional, `cvText` ≤ 20000 optional, `cv` File optional: size ≤ 10 MiB (`CV_MAX_BYTES`), PDF / DOCX / TXT by media type or name (`isCvFile`) → else 400 `{error}`. LinkedIn or CV (file or text) required → 400.
4. `externalId = sha256Hex(`${tag}|${email.toLowerCase()}`)` (one application per email per position; a resubmit is a duplicate).
5. `ingestApplication({ source: "apply-page", ... }, env, now)`.
6. Response: `capped` (new or resubmitted) → 429 `{error: "too many applications"}`; anything else (including duplicate, unmatched, incomplete) → **201** `{received: true}`, the same code for a duplicate so the status cannot reveal that an email already applied (the honeypot is the only 200). A funnel failure → 500 `{error}` with a plain sentence, details to `console.error` only. Never return applicationId, status or runId.

**Known gap (funnel, not this unit):** a `capped` row is idempotent like any other, so a candidate who retries after the hour gets 429 again and no run starts. The funnel should re-evaluate a `capped` duplicate (or the operator UI must re-run it).

## Tests (`apply.test.ts`)
- 403 wrong origin; honeypot → 200 and no D1 write; 400 bad tag / missing name / bad email / not a LinkedIn link / unsupported file (.doc, .png) / > 10 MiB / long message / long cvText / oversized Content-Length; 201 with LinkedIn only; 201 with PDF → R2 put; 201 with DOCX → R2 put and extracted text starts the run; 201 with pasted cvText only → run started with that text; file + text → file stored, text ignored; duplicate → 201 `{received:true}` and no second run; unknown tag → 201 stored `unmatched`; capped → 429; funnel failure → 500 without detail; no success body ever differs from `{"received":true}`.
- `apply-fields.test.ts` covers `checkApply` (`isCvFile`: pdf/docx/txt by type or name, `.doc` and images rejected with the formats sentence, cvText length, LinkedIn-or-CV with text counting as a CV) and `formatSize`; `cv-text.test.ts` covers `cvKind` and DOCX extraction on a minimal `.docx` built at test time (`fixtures/tiny-docx.ts`: a stored ZIP with `[Content_Types].xml`, `_rels/.rels`, `word/document.xml`), empty DOCX → note, non-ZIP bytes with a .docx name → note; `_lib/__tests__/same-origin.test.ts` covers `rejectCrossOrigin`.
- Build a multipart `Request` with `FormData` + `File` in Node (undici globals in Node 22+).
