-- FAZA 7b (Agent Memory): persistent background agent jobs.
-- The /api/agent/background flow writes through to this table so job progress
-- and final results survive a server restart. Idempotent so re-running is safe.

CREATE TABLE IF NOT EXISTS "agent_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "machine_id" varchar(255) NOT NULL,
  "session_id" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'running',
  "error" text,
  "finished" boolean NOT NULL DEFAULT false,
  "timeline" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_jobs_user_id_idx" ON "agent_jobs" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_jobs_status_idx" ON "agent_jobs" ("status");
