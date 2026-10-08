-- 0009_positions: a stored job position (pasted or fetched posting) with editable must-haves that runs start from (plans/007).
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0009_positions.sql
-- Deps:    D1 (SQLite)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev; ingest and purge tests use fakes)
--
-- r2_key points at positions/<id>.json (raw posting payload); both it and the row are purged at expires_at.
-- investigations.position_id is cleared (set NULL) by the purge sweep before the position row is deleted.

CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  family TEXT NOT NULL,
  company TEXT,
  location TEXT,
  board TEXT,
  posting_url TEXT,
  external_id TEXT,
  must_haves_json TEXT NOT NULL,
  excerpt TEXT,
  r2_key TEXT,
  ingest_method TEXT NOT NULL,
  ingest_cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE UNIQUE INDEX positions_board_external ON positions (board, external_id) WHERE board IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX positions_expires_at ON positions (expires_at);

ALTER TABLE investigations ADD COLUMN position_id TEXT REFERENCES positions(id);
CREATE INDEX investigations_position_id ON investigations (position_id);
