# Unit: funnel (`startRun` extraction + `ingestApplication`)

## Files
- `src/workflow/start-run.ts` (new) + `src/workflow/__tests__/start-run.test.ts`
- `src/workflow/intake.ts` (new) + `src/workflow/__tests__/intake.test.ts`
- `src/domain/cv-text.ts` (new) + `src/domain/__tests__/cv-text.test.ts` (+ a 1-page fixture `__tests__/fixtures/cv-sample.pdf` generated in the test with a tiny hand-written PDF or `unpdf`'s own test asset; keep < 20 KB)
- `src/app/api/runs/route.ts` (modified: calls `startRun`; auth, dedup and caps unchanged)
- `src/domain/run-status.ts` (modified: add `INTAKE_PER_HOUR_CAP_DEFAULT = 10`)
- `package.json`: add `unpdf` (dependency)

## `start-run.ts`

```ts
export type StartRunEnv = { DB: D1Database; RESEARCH_RUN: Workflow; RUN_BUDGET_USD: string; RUN_BUDGET_CALLS: string };
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
- Anything else → `{ text: null, note: "unsupported CV format <contentType>" }`. Never throws; a library error becomes a note.

## `intake.ts`

```ts
export type IntakeEnv = StartRunEnv & { SOURCES: R2Bucket; INTAKE_PER_HOUR_CAP?: string };
export type IntakeResult = { applicationId: string; status: ApplicationStatus; runId: string | null; duplicate: boolean; note: string | null };
export async function ingestApplication(raw: IntakeInput, env: IntakeEnv, now: Date, opts?: { senderAllowed?: boolean }): Promise<IntakeResult>
```
Sequence (each step one D1/R2 call, no transaction):
1. `IntakeInput.parse(raw)` (throws ZodError to the caller; routes turn it into 400).
2. `SELECT id, status, run_id FROM applications WHERE source = ? AND external_id = ?` → hit: return `{duplicate: true, ...}`; no second run, nothing written.
3. `id = crypto.randomUUID()`; `INSERT INTO applications (... status 'received' ...)`. A UNIQUE failure here (race) re-runs step 2 and returns the duplicate.
4. If `cv` present: `extractCvText`; `SOURCES.put(cvR2Key(id, filename), bytes, { httpMetadata: { contentType } })`; `cvText = input.cvText ?? extracted`.
5. Tag: `IntakeTag.safeParse(input.tag)` ok and `SELECT role, goal FROM intake_tags WHERE tag = ?` hit → known.
6. `candidateInput({linkedinUrl, cvText})`.
7. `capped = runsStartedSince(DB, now-1h, "intake") >= Number(INTAKE_PER_HOUR_CAP ?? 10)` (evaluated only when the earlier checks pass).
8. `decideStatus({...})`. If `run-started`: `startRun(env, { goal, role, profileUrl, cvText, via: "intake", applicationId: id }, now)`.
9. `UPDATE applications SET status, run_id, note, linkedin_url, cv_key, cv_text WHERE id = ?` (note = decideStatus note + joined parser notes + `input.note`, "; "-separated, ≤ 1000 chars).
10. Return.
Errors in steps 4–8 (R2, D1, Workflow create) propagate after the row exists with status `received`; the `/intake` page shows such rows and the note stays null. Never swallow.

## Tests
- `start-run.test.ts`: inserts the expected columns and binds in order (fake D1 records SQL + args); `RESEARCH_RUN.create` called with `{id, params:{runId:id}}`; `applicationId` lands in `application_id`; `runsStartedSince` with and without `via`.
- `cv-text.test.ts`: real small PDF → text contains a known word; `%PDF`-less bytes with pdf contentType → note; txt passthrough; cap at CV_MAX.
- `intake.test.ts` (fakes like `elevenlabs.test.ts`, no module mocks): happy path LinkedIn-only → `run-started`, run inserted with via `intake`, role from the tag; CV-only PDF → cv_key written to the R2 fake and cv_text extracted; duplicate returns the first id and never calls create; unknown tag → `unmatched` + no run; sender not allowed → `unmatched`; no candidate → `incomplete`; cap reached → `capped`; R2 failure propagates and leaves the row at `received`.
- Existing `run-body.test.ts` and any route test unchanged and green.
