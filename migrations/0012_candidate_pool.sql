-- 0012_candidate_pool: applications and intake tags can belong to a position, so a position page shows a candidate pool (plans/010).
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0012_candidate_pool.sql
-- Deps:    D1 (SQLite), applications + intake_tags (0009), positions (0011)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev); row contract in src/workflow/__tests__/intake.test.ts
--
-- SQLite cannot alter a CHECK, so applications is rebuilt: source gains 'manual', status gains 'pooled', and a new
-- position_id points at the position whose pool the row sits in. The purge sweep NULLs position_id (applications
-- and intake_tags) before it deletes a position. Nothing else references applications.

CREATE TABLE applications_new (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL CHECK (source IN ('email','form','apply-page','startupjobs','manual')),
  external_id  TEXT NOT NULL,
  tag          TEXT,
  name         TEXT,
  email        TEXT,
  phone        TEXT,
  linkedin_url TEXT,
  cv_key       TEXT,
  cv_text      TEXT,
  cover_letter TEXT,
  status       TEXT NOT NULL CHECK (status IN ('received','pooled','run-started','unmatched','incomplete','capped')),
  run_id       TEXT REFERENCES investigations(id),
  note         TEXT,
  received_at  TEXT NOT NULL,
  position_id  TEXT REFERENCES positions(id)
);

INSERT INTO applications_new (id, source, external_id, tag, name, email, phone, linkedin_url, cv_key, cv_text, cover_letter, status, run_id, note, received_at)
SELECT id, source, external_id, tag, name, email, phone, linkedin_url, cv_key, cv_text, cover_letter, status, run_id, note, received_at FROM applications;

DROP TABLE applications;
ALTER TABLE applications_new RENAME TO applications;

CREATE UNIQUE INDEX idx_applications_external ON applications(source, external_id);
CREATE INDEX idx_applications_received ON applications(received_at, id);
CREATE INDEX idx_applications_position ON applications(position_id, received_at);

ALTER TABLE intake_tags ADD COLUMN position_id TEXT REFERENCES positions(id);
CREATE INDEX idx_intake_tags_position ON intake_tags(position_id);
