# Unit: data (migration 0009 + Application schema)

## Files
- `migrations/0009_intake.sql` (new; SQL header comment like `0007_profile_first.sql`)
- `src/domain/application.ts` (new) + `src/domain/__tests__/application.test.ts`

## Migration

```sql
CREATE TABLE intake_tags (
  tag                  TEXT PRIMARY KEY,                 -- [a-z0-9][a-z0-9-]{1,39}
  role                 TEXT NOT NULL,                    -- free text, drives role_questions (≤ 300)
  goal                 TEXT NOT NULL DEFAULT 'hiring' CHECK (goal IN ('hiring','due-diligence')),
  startupjobs_offer_id TEXT,                             -- StartupJobs offer id this tag receives
  created_at           TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_intake_tags_startupjobs ON intake_tags(startupjobs_offer_id) WHERE startupjobs_offer_id IS NOT NULL;

CREATE TABLE applications (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL CHECK (source IN ('email','form','apply-page','startupjobs')),
  external_id  TEXT NOT NULL,          -- Message-ID / form response id / sha256(tag|email) / StartupJobs application id
  tag          TEXT,                   -- as received; NULL when absent
  name         TEXT,
  email        TEXT,
  phone        TEXT,
  linkedin_url TEXT,                   -- normalised https://www.linkedin.com/in/<handle>
  cv_key       TEXT,                   -- R2 key intake/<id>/<filename>, NULL when no file
  cv_text      TEXT,                   -- extracted or pasted, ≤ 20000
  cover_letter TEXT,
  status       TEXT NOT NULL CHECK (status IN ('received','run-started','unmatched','incomplete','capped')),
  run_id       TEXT REFERENCES investigations(id),
  note         TEXT,                   -- why unmatched/incomplete/capped, parser notes
  received_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_applications_external ON applications(source, external_id);
CREATE INDEX idx_applications_received ON applications(received_at, id);   -- matches ORDER BY received_at DESC, id DESC

ALTER TABLE investigations ADD COLUMN application_id TEXT;   -- set by startRun when via = 'intake'
```

`via` (0006) has no CHECK; the new value is `'intake'`.

`idx_applications_received` covers `(received_at, id)` so the `/intake` list query (`ORDER BY received_at DESC, id DESC`) reads the index in order. 0009 is not applied remotely yet, so the migration is edited in place rather than followed by a new one.

## `src/domain/application.ts` (pure, Zod 4)

```ts
export const IntakeTag = z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/);
export const ApplicationSource = z.enum(["email","form","apply-page","startupjobs"]);
export const ApplicationStatus = z.enum(["received","run-started","unmatched","incomplete","capped"]);
export const CvFile = z.object({ bytes: z.instanceof(ArrayBuffer), filename: z.string().min(1).max(200), contentType: z.string().max(100) });
export const IntakeInput = z.object({
  source: ApplicationSource,
  externalId: z.string().min(1).max(300),
  tag: z.string().trim().toLowerCase().max(60).optional(),   // validated against IntakeTag later; kept raw for the note
  name: z.string().trim().min(1).max(200).optional(),
  email: z.email().max(200).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  linkedinUrl: z.string().max(500).optional(),               // normalised in candidateInput(); invalid → dropped with a note
  cvText: z.string().trim().min(1).max(CV_MAX).optional(),   // CV_MAX = 20000 moves here from run-body.ts (run-body imports it)
  cv: CvFile.optional(),
  coverLetter: z.string().trim().min(1).max(10_000).optional(),
  note: z.string().max(1000).optional(),
});
export type Application = { id, source, externalId, tag: string|null, name.., status, runId: string|null, note: string|null, receivedAt: string };  // row shape, camelCase
export function candidateInput(app: Pick<IntakeInput,"linkedinUrl"|"cvText">): { profileUrl?: string; cvText?: string; notes: string[] }
  // profileUrl via normalizeLinkedinProfile (src/domain/profile-url.ts); an invalid URL adds the note
  // "not a LinkedIn profile URL: <first 120 chars>" and is dropped
export function decideStatus(args: { tagKnown: boolean; senderAllowed: boolean; candidate: {profileUrl?: string; cvText?: string}; capped: boolean }): { status: Exclude<ApplicationStatus,"received">; note: string | null }
  // order: !tagKnown → unmatched("unknown tag") ; !senderAllowed → unmatched("sender not allowed") ;
  // no profileUrl && no cvText → incomplete("no LinkedIn profile URL and no readable CV text") ;
  // capped → capped("intake run cap reached for this hour") ; else run-started (note null)
export function safeFilename(name: string): string
  // basename (/ and \ separators), runs of chars outside [A-Za-z0-9._-] become one "_", leading "." / "_" stripped,
  // ≤ 80 chars keeping the extension, default "cv.pdf" when nothing is left
export function cvR2Key(applicationId: string, filename: string): string  // `intake/${applicationId}/${safeFilename(filename)}`
```

## Tests (`application.test.ts`)
- IntakeTag accepts `senior-be-2026`, rejects `Senior`, `-x`, 41 chars, empty.
- IntakeInput rejects an unknown source and a cvText over CV_MAX; lowercases the tag.
- candidateInput normalises `cz.linkedin.com/in/Josef-Buryan?x=1`, drops `linkedin.com/company/x` with a note, passes cvText through.
- decideStatus covers all five branches in the stated order (unknown tag wins over incomplete, incomplete wins over capped).
- safeFilename strips paths and odd characters, caps length, defaults.
- `run-body.ts` still exports `CV_MAX` (re-export) and its existing test passes unchanged.
