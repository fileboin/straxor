-- Foundation (Iteration 0): persistent task state + process run history.
-- Idempotent so re-running is safe (matches 0009_github_identity style).

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid,
  "repo" varchar(255),
  "title" varchar(500) NOT NULL,
  "prompt" text NOT NULL DEFAULT '',
  "branch" varchar(255),
  "status" varchar(20) NOT NULL DEFAULT 'QUEUED',
  "workspace_dir" text,
  "commit_hash" varchar(255),
  "diff" text,
  "error" text,
  "retries" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "process_runs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "task_id" uuid,
  "user_id" uuid,
  "pid" integer,
  "command" text NOT NULL,
  "args" text,
  "cwd" text,
  "status" varchar(20) NOT NULL DEFAULT 'running',
  "exit_code" integer,
  "signal" varchar(20),
  "started_at" timestamp NOT NULL DEFAULT now(),
  "ended_at" timestamp,
  "stdout_bytes" integer NOT NULL DEFAULT 0,
  "stderr_bytes" integer NOT NULL DEFAULT 0,
  "error" text
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "process_runs" ADD CONSTRAINT "process_runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "process_runs" ADD CONSTRAINT "process_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_user_id_idx" ON "tasks" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "process_runs_task_id_idx" ON "process_runs" ("task_id");
