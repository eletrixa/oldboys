-- 0007_profile_first: the start form takes the candidate's LinkedIn profile URL or a pasted CV (plans/006).
--
-- Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
-- Module:  migrations/0007_profile_first.sql
-- Deps:    D1 (SQLite)
-- Tested:  n/a (applied by pnpm db:migrate:local in dev)
--
-- subject and anchor stay NOT NULL: a profile-first run inserts "" and the Workflow's seed_profile step fills them.

ALTER TABLE investigations ADD COLUMN profile_url TEXT;
ALTER TABLE investigations ADD COLUMN cv_text TEXT;
