-- 0017_positions_organization: a position belongs to the recruiter's organization, so a session only sees its own company's positions.
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0017_positions_organization.sql
-- Deps:    D1 (SQLite), positions (0011), organizations + investigations.organization_id (0010)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev); the column is written and filtered in src/app/api/positions/handler.ts
--
-- Nullable, same reference style as investigations.organization_id: bearer, extension and intake-webhook positions keep NULL.
-- Code deployed before this migration never reads the column, so it is safe to apply first (CI does not apply migrations).
-- Backfill: a position gets the organization only when every run started from it that carries an organization_id names
-- the same one. Positions with no such run, or with runs from two or more organizations, stay NULL (hidden from sessions).

ALTER TABLE positions ADD COLUMN organization_id TEXT REFERENCES organizations(id);
CREATE INDEX idx_positions_org ON positions(organization_id, created_at);

UPDATE positions SET organization_id = (
  SELECT CASE WHEN COUNT(DISTINCT i.organization_id) = 1 THEN MIN(i.organization_id) END
  FROM investigations i
  WHERE i.position_id = positions.id AND i.organization_id IS NOT NULL
)
WHERE organization_id IS NULL;
