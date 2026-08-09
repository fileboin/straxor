CREATE TABLE IF NOT EXISTS "agent_bus_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "chain_id" varchar(255) NOT NULL,
  "from_panel" varchar(20) NOT NULL,
  "to_panel" varchar(20) NOT NULL,
  "action" varchar(20) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'pending',
  "hop_count" integer NOT NULL DEFAULT 0,
  "warning" text,
  "prompt" text NOT NULL,
  "content" text NOT NULL,
  "metadata" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "agent_bus_events"
  ADD CONSTRAINT "agent_bus_events_session_id_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "agent_bus_events"
  ADD CONSTRAINT "agent_bus_events_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "agent_bus_events_session_idx" ON "agent_bus_events" ("session_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_bus_events_chain_idx" ON "agent_bus_events" ("chain_id");
