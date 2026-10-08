# Unit: email connector (Cloudflare Email Routing → `worker.email()`)

## Files
- `src/domain/email-intake.ts` (new) + `src/domain/__tests__/email-intake.test.ts` + fixtures `src/domain/__tests__/fixtures/*.eml`
- `src/domain/html-text.ts` (new, `htmlToText`, shared with the StartupJobs connector) + `src/domain/__tests__/html-text.test.ts`
- `src/workflow/intake-email.ts` (new) + `src/workflow/__tests__/intake-email.test.ts`
- `src/worker.ts` (modified: export `email`)
- `package.json`: add `postal-mime` (dependency)

## `email-intake.ts` (pure)

```ts
export type ParsedMail = { messageId?: string; from?: { address?: string; name?: string }; subject?: string; text?: string; html?: string; attachments: readonly { filename: string | null; mimeType: string; content: ArrayBuffer | Uint8Array | string }[] };  // structural subset of postal-mime's Email (a parsed Email is assignable)
export function splitRecipient(rcpt: string): { local: string; tag: string | null }   // "Jobs+Senior-BE@asajj.cz" → { local: "jobs", tag: "senior-be" }; no plus part (or "jobs+@") → tag null; lowercased; display-name form "X <jobs+a@b>" handled
export function firstLinkedinUrl(text: string): string | null       // first linkedin.com/in/… that normalizeLinkedinProfile accepts; trailing .,;:!? ignored; company pages skipped
export function pickCv(attachments): CvFile | null   // first application/pdf (or .pdf name) else first text/plain; images and others ignored; null filename → cv.pdf / cv.txt
export function senderAllowed(from: string | undefined, allowList: string): boolean   // blank allowList → true; entries are addresses or domains ("@d" ok), a domain covers its subdomains, case-insensitive; missing sender with a list → false
export function parseIntakeMail(mail: ParsedMail, rcptTo: string, rawFallbackId: string): IntakeInput
  // source "email"; externalId = messageId (when 1..300 chars) ?? rawFallbackId (sha256 hex of raw, computed by the caller); tag from rcptTo;
  // name = from.name (blank → undefined, ≤ 200); email = from.address when it is a valid address, else dropped;
  // linkedinUrl = firstLinkedinUrl(text + "\n" + raw html)  — raw html, not htmlToText, so a profile only in an href is found;
  // cv = pickCv; coverLetter = text, or htmlToText(html) when there is no text, trimmed, first 10000 chars; note = "subject: <subject>" (≤ 1000)
  // Every field is cut or dropped so IntakeInput.parse never throws on a real mail.
```
`htmlToText` (`src/domain/html-text.ts`): drop comments and head/script/style, `<br>` and closing block tags become newlines, strip other tags, decode `&amp; &lt; &gt; &quot; &apos; &nbsp;` and numeric entities in one pass, collapse spaces per line, drop blank lines. No dependency.

## `intake-email.ts`

```ts
export type IntakeEmailEnv = IntakeEnv & { INTAKE_FORWARD_TO?: string; INTAKE_FROM_ALLOW?: string };
export async function handleIntakeEmail(message: ForwardableEmailMessage, env: IntakeEmailEnv, now: Date, log: (line: string) => void): Promise<void>
```
0. Recipient gate (the zone has a catch-all to this Worker): `splitRecipient(message.to).local` must be `jobs` (covers `jobs@` and `jobs+<tag>@`), else `message.setReject("no such address")`, return, nothing stored and nothing forwarded.
1. `message.rawSize > 10 * 1024 * 1024` → `message.setReject("message too large")`, return.
2. `raw = await new Response(message.raw).arrayBuffer()`; `parsed = await PostalMime.parse(raw)`; `rawId = sha256hex(raw)` (WebCrypto).
3. `input = parseIntakeMail(parsed, message.to, rawId)`; `allowed = senderAllowed(message.from, env.INTAKE_FROM_ALLOW ?? "")`.
4. `result = await ingestApplication(input, env, now, { senderAllowed: allowed })`; `log(`intake email ${result.applicationId} ${result.status}`)`. Any error in steps 2–4 (MIME parse included) is logged as `intake email failed: <message>` and rethrown after the forward attempt.
5. If `env.INTAKE_FORWARD_TO` is non-empty: `await message.forward(env.INTAKE_FORWARD_TO)`; a forward failure is logged as `intake email forward failed: <message>`, never thrown (the application is already stored).

`src/worker.ts`:
```ts
email: async (message, env) => { await handleIntakeEmail(message, env, new Date(), (line) => { console.warn(line); }); },
```
`console.warn`, because the lint config allows only `warn` and `error`; it shows in `wrangler tail` the same way. The handler type is `EmailExportedHandler<CloudflareEnv>` via `ExportedHandler["email"]` (workers-types ≥ 4.2024).

## Fixtures (hand-written, ≤ 6 KB each, no real people)
- `gmail-forward.eml`: multipart/mixed, text body with a LinkedIn URL, PDF attachment (tiny valid PDF), `To: jobs+senior-be@asajj.cz`.
- `seznam-copy.eml`: text/plain only, Czech diacritics in UTF-8 quoted-printable, no attachment, LinkedIn URL in signature.
- `jobs-cz-notification.eml`: HTML-only body as Jobs.cz would send (placeholder structure: candidate name, email, a "Životopis" link), no attachment → expect `incomplete` unless a LinkedIn URL is present. Mark in the fixture header that the real shape is to be captured from a live test application.
- `no-tag.eml`: `To: jobs@asajj.cz` → `unmatched`.

## Tests
- `email-intake.test.ts`: each helper plus `parseIntakeMail` over the four fixtures parsed with postal-mime (real library in Node).
- `intake-email.test.ts`: fake `ForwardableEmailMessage` (`raw` as ReadableStream from the fixture, `rawSize`, `setReject`/`forward` spies) + the funnel fakes: wrong recipient (`info@asajj.cz`) → reject and nothing stored; oversize → reject and nothing stored; happy → application stored and forwarded; forward failure → logged, no throw; `INTAKE_FROM_ALLOW` excluding the sender → `unmatched`.
- `pnpm exec wrangler deploy --dry-run --outdir <scratch>` still bundles (`email` export present).
