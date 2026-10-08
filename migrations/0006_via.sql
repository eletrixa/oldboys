-- 0006_via: where a run was started from. 'start' = the public start form (capped separately), 'api' = bearer clients.
ALTER TABLE investigations ADD COLUMN via TEXT NOT NULL DEFAULT 'api';
