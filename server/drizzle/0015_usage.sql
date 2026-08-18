-- Phase 3 (Analytics dashboard): persist usage events and budgets so the
-- Usage & Cost panel survives server restarts (the default "custom" adapter
-- was previously in-memory only). Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "timestamp" timestamp NOT NULL DEFAULT now(),
  "project_id" uuid,
  "machine_id" varchar(255),
  "provider" varchar(100) NOT NULL,
  "model" varchar(255) NOT NULL,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "total_tokens" integer NOT NULL DEFAULT 0,
  "cost_usd" double precision NOT NULL DEFAULT 0,
  "latency_ms" integer,
  "success" boolean NOT NULL DEFAULT true,
  "error_message" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_events_user_id_idx" ON "usage_events" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_events_timestamp_idx" ON "usage_events" ("timestamp");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_budgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "monthly_limit_usd" double precision NOT NULL DEFAULT 0,
  "current_spend_usd" double precision NOT NULL DEFAULT 0,
  "alert_threshold_percent" integer NOT NULL DEFAULT 80,
  "is_hard_limit" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "usage_budgets" ADD CONSTRAINT "usage_budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_budgets_user_id_idx" ON "usage_budgets" ("user_id");
