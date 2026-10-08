-- Add the page a run was marked from, so a second mark of the same profile reuses the run.
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0002_source_url.sql
-- Deps:    D1 (SQLite)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev)
--
-- 0002_source_url: optional source_url on investigations (plans/004, browser extension dedupe).
ALTER TABLE investigations ADD COLUMN source_url TEXT;
CREATE INDEX idx_investigations_source_url ON investigations(source_url, goal, created_at);
