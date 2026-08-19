-- FAZA 8 (Team Verification Gate): persist the team run's build+test result on
-- the task row so the approval UI can show exactly what was verified before
-- Approve → Commit → Push. Idempotent so re-running is safe.

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "verify" jsonb;
