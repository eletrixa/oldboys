-- 0014_suggest_attempts: let auth_attempts count profile-suggestion lookups (kind 'suggest', subject = account id; plans/011).
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0014_suggest_attempts.sql
-- Deps:    D1 (SQLite), auth_attempts (0010)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev; the suggest handler test uses fakes)
--
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt with the wider kind list and the rows copied.

CREATE TABLE auth_attempts_new (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  kind     TEXT NOT NULL CHECK (kind IN ('register', 'login_fail', 'ares', 'suggest')),
  subject  TEXT NOT NULL,
  at       TEXT NOT NULL
);
INSERT INTO auth_attempts_new (id, kind, subject, at) SELECT id, kind, subject, at FROM auth_attempts;
DROP TABLE auth_attempts;
ALTER TABLE auth_attempts_new RENAME TO auth_attempts;
CREATE INDEX idx_auth_attempts_lookup ON auth_attempts(kind, subject, at);
