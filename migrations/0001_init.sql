-- Initial D1 schema: core aggregates from the 001 domain map.
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0001_init.sql
-- Deps:    D1 (SQLite)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev)
--
-- 0001_init: core aggregates from plans/001 domain map, hosted on D1 per plans/002.
-- run_id == investigations.id. Ledger is append-only; seq is per-run monotonic.

CREATE TABLE investigations (
  id            TEXT PRIMARY KEY,
  subject       TEXT NOT NULL,
  anchor        TEXT NOT NULL,
  goal          TEXT NOT NULL CHECK (goal IN ('hiring', 'due-diligence')),
  status        TEXT NOT NULL CHECK (status IN ('queued', 'running', 'paused', 'done', 'failed')),
  budget_usd    REAL NOT NULL,
  budget_calls  INTEGER NOT NULL,
  budget_ms     INTEGER NOT NULL DEFAULT 180000,
  created_at    TEXT NOT NULL
);

CREATE TABLE candidates (
  id                TEXT PRIMARY KEY,
  run_id            TEXT NOT NULL REFERENCES investigations(id),
  name              TEXT NOT NULL,
  profile_urls_json TEXT NOT NULL,
  anchor_match      TEXT,
  score             REAL NOT NULL,
  decision          TEXT NOT NULL CHECK (decision IN ('merge', 'possibly-same-as', 'rejected'))
);
CREATE INDEX idx_candidates_run ON candidates(run_id);

CREATE TABLE sources (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES investigations(id),
  url         TEXT NOT NULL,
  actor       TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  excerpt     TEXT NOT NULL,
  r2_key      TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX idx_sources_run ON sources(run_id);

CREATE TABLE claims (
  id                TEXT PRIMARY KEY,
  run_id            TEXT NOT NULL REFERENCES investigations(id),
  question_id       TEXT NOT NULL,
  candidate_id      TEXT REFERENCES candidates(id),
  text              TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('FACT', 'INFERENCE')),
  confidence        REAL NOT NULL,
  quote             TEXT,
  supports_json     TEXT NOT NULL,
  contradicts_json  TEXT NOT NULL,
  rank              INTEGER NOT NULL
);
CREATE INDEX idx_claims_run ON claims(run_id);

CREATE TABLE gaps (
  run_id       TEXT NOT NULL REFERENCES investigations(id),
  question_id  TEXT NOT NULL,
  reason       TEXT NOT NULL,
  PRIMARY KEY (run_id, question_id)
);
CREATE INDEX idx_gaps_run ON gaps(run_id);

CREATE TABLE ledger_entries (
  run_id    TEXT NOT NULL REFERENCES investigations(id),
  seq       INTEGER NOT NULL,
  ts        TEXT NOT NULL,
  step      TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('call', 'llm', 'decision', 'pause')),
  cost_usd  REAL NOT NULL DEFAULT 0,
  ms        INTEGER NOT NULL DEFAULT 0,
  ref_json  TEXT,
  PRIMARY KEY (run_id, seq)
);
CREATE INDEX idx_ledger_entries_run ON ledger_entries(run_id);
