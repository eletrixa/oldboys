-- 0010_accounts: recruiter self-serve accounts, organizations (ARES or manual), cookie sessions, auth rate-limit counters, ARES cache.
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0010_accounts.sql
-- Deps:    D1 (SQLite)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev)
--
-- investigations gains nullable account_id / organization_id: bearer and extension runs keep NULL.

CREATE TABLE organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  ico         TEXT,
  dic         TEXT,
  legal_form  TEXT,
  address     TEXT,
  country     TEXT NOT NULL DEFAULT 'CZ',
  source      TEXT NOT NULL CHECK (source IN ('ares', 'manual')),
  created_at  TEXT NOT NULL
);
CREATE TABLE accounts (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  password_hash    TEXT NOT NULL,
  organization_id  TEXT NOT NULL REFERENCES organizations(id),
  created_at       TEXT NOT NULL
);
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  account_id  TEXT NOT NULL REFERENCES accounts(id),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX idx_sessions_account ON sessions(account_id);
CREATE TABLE auth_attempts (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  kind     TEXT NOT NULL CHECK (kind IN ('register', 'login_fail', 'ares')),
  subject  TEXT NOT NULL,
  at       TEXT NOT NULL
);
CREATE INDEX idx_auth_attempts_lookup ON auth_attempts(kind, subject, at);
CREATE TABLE ares_cache (
  ico           TEXT PRIMARY KEY,
  status        TEXT NOT NULL CHECK (status IN ('found', 'not_found')),
  payload_json  TEXT,
  fetched_at    TEXT NOT NULL
);
ALTER TABLE investigations ADD COLUMN account_id TEXT REFERENCES accounts(id);
ALTER TABLE investigations ADD COLUMN organization_id TEXT REFERENCES organizations(id);
CREATE INDEX idx_investigations_org ON investigations(organization_id, created_at);
