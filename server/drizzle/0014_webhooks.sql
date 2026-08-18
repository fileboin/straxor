-- Phase 3 (Webhook system): user-registered outbound webhook endpoints for
-- external integrations. Each hook subscribes to a set of event names and is
-- delivered via signed POST requests. Idempotent so re-running is safe.

CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "url" varchar(2000) NOT NULL,
  "secret" varchar(500),
  "events" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "active" boolean NOT NULL DEFAULT true,
  "last_delivery_at" timestamp,
  "last_delivery_status" varchar(20),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_user_id_idx" ON "webhooks" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_active_idx" ON "webhooks" ("active");
