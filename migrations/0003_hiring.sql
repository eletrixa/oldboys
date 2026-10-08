-- 0003_hiring: role text + dynamic must-have questions on the investigation, identity details on candidates, brief table.
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0003_hiring.sql
-- Deps:    D1 (SQLite)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev)

ALTER TABLE investigations ADD COLUMN role TEXT;
ALTER TABLE investigations ADD COLUMN questions_json TEXT;

ALTER TABLE candidates ADD COLUMN platform TEXT NOT NULL DEFAULT 'web';
ALTER TABLE candidates ADD COLUMN handle TEXT;
ALTER TABLE candidates ADD COLUMN snippet TEXT NOT NULL DEFAULT '';
ALTER TABLE candidates ADD COLUMN reasons_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE briefs (
  run_id      TEXT PRIMARY KEY REFERENCES investigations(id),
  brief_json  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
