-- FAZA 7b/7c (Team fan-out): link background jobs to a persistent team task and
-- tag each job with its role label. Idempotent so re-running is safe.

ALTER TABLE "agent_jobs" ADD COLUMN IF NOT EXISTS "task_id" uuid;
--> statement-breakpoint
ALTER TABLE "agent_jobs" ADD COLUMN IF NOT EXISTS "label" varchar(50);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_jobs_task_id_idx" ON "agent_jobs" ("task_id");
