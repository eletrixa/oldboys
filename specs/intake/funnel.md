# Unit: funnel (`startRun` extraction + `ingestApplication`)

## Files
- `src/workflow/start-run.ts` (new) + `src/workflow/__tests__/start-run.test.ts`
- `src/workflow/intake.ts` (new) + `src/workflow/__tests__/intake.test.ts`
- `src/domain/cv-text.ts` (new) + `src/domain/__tests__/cv-text.test.ts` (the 1-page PDF is built at test time by `src/domain/__tests__/fixtures/tiny-pdf.ts`; no binary fixture in git)
- `src/app/api/runs/route.ts` (modified: calls `startRun`; auth, dedup and caps unchanged)
- `src/domain/run-status.ts` (modified: add `INTAKE_PER_HOUR_CAP_DEFAULT = 10`)
- `package.json`: add `unpdf` (dependency)

## `start-run.ts`

```ts
export type StartRunEnv = { DB: D1Database; RESEARCH_RUN: Workflow<{ runId: string }>; RUN_BUDGET_USD: string; RUN_BUDGET_CALLS: string };
export type StartRunInput = { goal: GoalId; role?: string; profileUrl?: string; cvText?: string; subject?: string; anchor?: string; sourceUrl?: string; via: "api" | "start" | "intake"; applicationId?: string };
export async function startRun(env: StartRunEnv, input: StartRunInput, now: Date): Promise<{ id: string }>
  // exactly the INSERT + RESEARCH_RUN.create from the current route (columns + application_id); id = crypto.randomUUID()
export async function runsStartedSince(db: D1Database, since: Date, via?: string): Promise<number>
  // COUNT(*) FROM investigations WHERE created_at > ? [AND via = ?]
```
`POST /api/runs` keeps: bearer, body parse, sourceUrl dedup, `RUNS_PER_HOUR_CAP` and `START_PER_HOUR_CAP` (now through `runsStartedSince`), then `startRun(env, {...parsed.data, via}, now)` → 201 `{id}`. Behaviour and responses are byte-identical to today.

## `cv-text.ts`

```ts
export async function extractCvText(file: { bytes: ArrayBuffer; contentType: string; filename: string }): Promise<{ text: string | null; note: string | null }>
```
- PDF (contentType `application/pdf` or filename `.pdf`, and bytes start with `%PDF`): `unpdf` `extractText(..., { mergePages: true })`, whitespace-collapsed, trimmed, cut to `CV_MAX`; empty text → `{ text: null, note: "PDF has no extractable text (scanned?)" }`.
- `text/plain` or `.txt`: UTF-8 decode, same cap.
- PDF by type or name but without the `%PDF` header → `{ text: null, note: "not a PDF (no %PDF header)" }`.
- Empty text file → `{ text: null, note: "CV text file is empty" }`.
- Anything else → `{ text: null, note: "unsupported CV format <contentType>" }`. Never throws; a library error becomes the note `"PDF could not be read: <message>"`.
- unpdf gets a copy of the bytes, so the caller's `ArrayBuffer` is still intact for the R2 put.

## `intake.ts`

```ts
export type IntakeEnv = StartRunEnv & { SOURCES: R2Bucket; INTAKE_PER_HOUR_CAP?: string };
export type IntakeResult = { applicationId: string; status: ApplicationStatus; runId: string | null; duplicate: boolean; note: string | null };
export async function ingestApplication(raw: IntakeInput, env: IntakeEnv, now: Date, opts?: { senderAllowed?: boolean }): Promise<IntakeResult>
```
Sequence (no transaction):
1. `IntakeInput.parse(raw)` (throws ZodError to the caller; routes turn it into 400).
2. `SELECT id, status, run_id, note, tag, linkedin_url FROM applications WHERE source = ? AND external_id = ?` → hit: return `{duplicate: true, ...}` with the stored status, run id and note; no second run, nothing written. Two exceptions: a `capped` hit (see "Capped retry") and a resumable `received` hit (marked failed, or older than `STALE_RECEIVED_MS`; see "Stale received").
3. `id = crypto.randomUUID()`; `INSERT INTO applications (id, source, external_id, tag, name, email, phone, cover_letter, received_at, status 'received')`. A UNIQUE failure here (race) re-runs step 2 and returns the duplicate; any other error propagates.
4. In parallel (`Promise.all`): `extractCvText(cv)` when a `cv` came without `cvText` (its note joins the notes) and the tag lookup (`IntakeTag.safeParse(input.tag)` ok and `SELECT role, goal FROM intake_tags WHERE tag = ?` hit → known). unpdf reads its own copy of the bytes. `cvText = input.cvText ?? extracted`. Then, only when the tag is known and the sender allowed (the delivery can become a run), `SOURCES.put(cvR2Key(id, filename), bytes, { httpMetadata: { contentType } })`; an unmatched delivery stores no file (`cv_key` NULL) so a stranger's attachment costs no R2 object.
5. `candidateInput({linkedinUrl, cvText})`.
6. `decideAndStart` (the one decision tail, shared with the capped retry): `capped = runsStartedSince(DB, now - HOUR_MS, "intake") >= cap`, queried only when the tag is known, the sender allowed and the candidate complete; `cap` is `INTAKE_PER_HOUR_CAP` as a number, and unset, blank, negative or non-numeric means `INTAKE_PER_HOUR_CAP_DEFAULT` (10), never "no cap". `"0"` pauses intake runs. Then `decideStatus({...})`; if `run-started`: `startRun(env, { goal, role, profileUrl, cvText, via: "intake", applicationId: id }, now)`.
7. `UPDATE applications SET status, run_id, note, linkedin_url, cv_key, cv_text WHERE id = ?` (note = `joinNotes(decideStatus note, extract note, candidate notes, input.note)`: "; "-separated, ≤ `NOTE_MAX` 1000 chars).
8. Return.
Errors in steps 4–6 (R2, D1, Workflow create) propagate after the row exists with status `received`; before rethrowing, the funnel writes `note = DELIVERY_FAILED_NOTE` on the row (best effort; when D1 itself is down the stale window covers it). Never swallow. The candidate retries or the operator re-sends the source; see "Stale received".

Stale received: a duplicate whose stored status is `received` is resumed when it carries `DELIVERY_FAILED_NOTE` (claimed atomically with `UPDATE applications SET note = NULL WHERE id = ? AND note = ?`; of two racing retries only the one that changed the row resumes, the other is answered like an in-flight duplicate) or when its `received_at` is at least `STALE_RECEIVED_MS` (5 min, exported) before `now` (a delivery that died without writing the mark). `SELECT id FROM investigations WHERE application_id = ?`: a hit means the failed attempt threw after `startRun` inserted the run, so that run is linked: `RESEARCH_RUN.get(id)` and, when it throws (the create was what failed), `RESEARCH_RUN.create({id, params: {runId}})`; then steps 4–7 run again from the new payload on the existing id (same R2 key, same UPDATE, CV text stored) with the linked run instead of a new decision, so no second run starts. Without a hit, steps 4–7 run in full. Both return `duplicate: true`. An unmarked `received` row younger than the window is returned unchanged like any duplicate (status `received`: the apply page answers 503 for it).

Capped queue: `retryCappedApplications(env, now)` (the Worker's `*/15 * * * *` cron) re-decides up to 20 `capped` rows, oldest first, through the same path as the capped retry; it stops at the first row that is still capped and skips a row whose decision is something else (for example its tag was removed). So a capped application starts its run without anyone delivering it again.

Capped retry: a duplicate whose stored status is `capped` re-reads `SELECT cv_text FROM applications WHERE id = ?`, looks up its stored tag, and runs the stored candidate (`linkedin_url`, `cv_text`) through the same `decideAndStart` (sender treated as allowed: the row passed that check when it was capped). The new payload is ignored. When the run starts, `UPDATE applications SET status, run_id, note WHERE id = ?` (`run-started`, the run id, null) and return it with `duplicate: true`; otherwise return the stored row unchanged, nothing written.

## Tests
- `start-run.test.ts`: inserts the expected columns and binds in order (fake D1 records SQL + args); `RESEARCH_RUN.create` called with `{id, params:{runId:id}}`; `applicationId` lands in `application_id`; `runsStartedSince` with and without `via`.
- `cv-text.test.ts`: real small PDF → text contains a known word; `%PDF`-less bytes with pdf contentType → note; txt passthrough; cap at CV_MAX.
- `intake.test.ts` (fakes like `elevenlabs.test.ts`, no module mocks): happy path LinkedIn-only → `run-started`, run inserted with via `intake`, role from the tag; CV-only PDF → cv_key written to the R2 fake and cv_text extracted; duplicate returns the first id and never calls create; unknown tag → `unmatched` + no run; sender not allowed → `unmatched`; no candidate → `incomplete`; cap reached → `capped`; a capped duplicate re-decides and starts the run once the hour has room; R2 failure propagates and leaves the row at `received` marked failed; a marked row is resumed by the very next delivery (CV stored; a re-failure marks it again; two racing retries resume once); an unmarked `received` row only after the stale window; a resume links an already inserted run, creating its Workflow instance when missing and never twice; the cron's queue pass starts capped rows oldest first and skips one whose tag is gone; unknown tag or disallowed sender with a CV stores no file.
- Existing `run-body.test.ts` and any route test unchanged and green.
