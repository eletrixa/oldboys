-- Mark each source as fetched for a confirmed identity or found by name search (possible namesake).
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0005_source_identity.sql
-- Deps:    D1 (SQLite)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev)
--
-- 0005_source_identity: review 001 fix 3; extract reads only merged (or serp) sources, the brief lists the rest as "also found, not confirmed".
ALTER TABLE sources ADD COLUMN identity TEXT NOT NULL DEFAULT 'unverified';
