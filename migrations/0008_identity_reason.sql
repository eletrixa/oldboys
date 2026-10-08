-- 0008_identity_reason: why a source was marked merged beyond its profile key (plans/006 follow-up).
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0008_identity_reason.sql
-- Deps:    D1 (SQLite)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev)
--
-- NULL = merged or unverified by profile key (or never re-marked); "name and employer match (<Org>)" = merged by the
-- name + employer corroboration rule in src/recipe/seams/resolve.ts (sourceIdentityUpdates).
ALTER TABLE sources ADD COLUMN identity_reason TEXT;
