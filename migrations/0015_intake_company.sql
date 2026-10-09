-- 0015_intake_company: the employer's name per intake tag, shown on the candidate-facing apply page (specs/intake/apply-page.md).
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0015_intake_company.sql
-- Deps:    D1 (SQLite), intake_tags (0009)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev); the column is read by src/app/apply/[tag]/page.tsx and
--          written by POST /api/intake/tags (body rules in src/app/api/intake/tags/__tests__/tag-body.test.ts)
--
-- Nullable: a tag without a company keeps working; the page then names only the role and the privacy line says
-- "the hiring company". Numbered 0015 because 0012-0014 are taken on main (candidate pool, role templates, suggest).

ALTER TABLE intake_tags ADD COLUMN company TEXT;   -- employer as the candidate knows it, <= 200 chars
