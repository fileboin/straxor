ALTER TABLE "git_connections" ADD COLUMN "name" varchar(120) DEFAULT 'GitHub' NOT NULL;--> statement-breakpoint
ALTER TABLE "git_connections" ADD COLUMN "username" varchar(120);--> statement-breakpoint
ALTER TABLE "git_connections" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$
DECLARE
  row RECORD;
BEGIN
  FOR row IN
    SELECT DISTINCT ON (user_id, platform) id
    FROM git_connections
    WHERE is_default = false
    ORDER BY user_id, platform, created_at ASC
  LOOP
    UPDATE git_connections SET is_default = true WHERE id = row.id;
  END LOOP;
END $$;