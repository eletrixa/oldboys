-- 0009_intake: job applications from email, Google Forms, the hosted apply page and StartupJobs (plans/008, specs/intake).
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0009_intake.sql
-- Deps:    D1 (SQLite), investigations (0001), via (0006); follows 0008_identity_reason on main
-- Tested:  n/a (applied by pnpm db:migrate:local in dev); row contract in src/workflow/__tests__/intake.test.ts
--
-- intake_tags maps a routing tag to the role and goal a run gets. applications holds one row per
-- (source, external_id); only the funnel (src/workflow/intake.ts) writes it. investigations.via gets the
-- new value 'intake' (no CHECK on via) and application_id points back at the row that started the run.

CREATE TABLE intake_tags (
  tag                  TEXT PRIMARY KEY,                 -- [a-z0-9][a-z0-9-]{1,39}
  role                 TEXT NOT NULL,                    -- free text, drives role_questions (<= 300)
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
  cv_text      TEXT,                   -- extracted or pasted, <= 20000
  cover_letter TEXT,
  status       TEXT NOT NULL CHECK (status IN ('received','run-started','unmatched','incomplete','capped')),
  run_id       TEXT REFERENCES investigations(id),
  note         TEXT,                   -- why unmatched/incomplete/capped, parser notes
  received_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_applications_external ON applications(source, external_id);
CREATE INDEX idx_applications_received ON applications(received_at, id);   -- matches ORDER BY received_at DESC, id DESC

ALTER TABLE investigations ADD COLUMN application_id TEXT;   -- set by startRun when via = 'intake'
