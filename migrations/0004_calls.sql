-- Verification Call tables, webhook idempotency, and a wider claims.kind CHECK (STATEMENT).
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0004_calls.sql
-- Deps:    D1 (SQLite); depends on 0001_init.sql, 0002_source_url.sql and 0003_hiring.sql
-- Tested:  n/a (applied by pnpm db:migrate:local in dev)
--
-- 0004_calls: plans/005-call-verification. calls mirrors src/domain/call.ts (booleans are INTEGER 0/1).
-- webhook_events makes ElevenLabs webhook delivery idempotent per (conversation_id, type).
-- claims is rebuilt because SQLite cannot alter a CHECK constraint in place.

CREATE TABLE calls (
  id                       TEXT PRIMARY KEY,
  run_id                   TEXT NOT NULL REFERENCES investigations(id),
  status                   TEXT NOT NULL CHECK (status IN ('drafted', 'dialing', 'done', 'failed', 'no_answer', 'refused', 'skipped')),
  provider                 TEXT NOT NULL CHECK (provider IN ('elevenlabs', 'mock')),
  provider_conversation_id TEXT,
  to_number_masked         TEXT,
  consent_ack              INTEGER NOT NULL DEFAULT 0,
  consent_note             TEXT,
  operator                 TEXT,
  brief_json               TEXT NOT NULL,
  result_r2_key            TEXT,
  call_successful          INTEGER,
  identity_confirmed       INTEGER,
  duration_secs            INTEGER,
  cost_usd                 REAL NOT NULL DEFAULT 0,
  failure_reason           TEXT,
  last_error               TEXT,
  created_at               TEXT NOT NULL,
  approved_at              TEXT,
  finished_at              TEXT
);
CREATE INDEX idx_calls_run ON calls(run_id);
CREATE UNIQUE INDEX idx_calls_conversation ON calls(provider_conversation_id);

CREATE TABLE webhook_events (
  conversation_id TEXT NOT NULL,
  type            TEXT NOT NULL,
  received_at     TEXT NOT NULL,
  PRIMARY KEY (conversation_id, type)
);

CREATE TABLE claims_new (
  id                TEXT PRIMARY KEY,
  run_id            TEXT NOT NULL REFERENCES investigations(id),
  question_id       TEXT NOT NULL,
  candidate_id      TEXT REFERENCES candidates(id),
  text              TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('FACT', 'INFERENCE', 'STATEMENT')),
  confidence        REAL NOT NULL,
  quote             TEXT,
  supports_json     TEXT NOT NULL,
  contradicts_json  TEXT NOT NULL,
  rank              INTEGER NOT NULL
);
INSERT INTO claims_new SELECT * FROM claims;
DROP TABLE claims;
ALTER TABLE claims_new RENAME TO claims;
CREATE INDEX idx_claims_run ON claims(run_id);
