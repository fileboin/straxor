ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_token" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token_expires" timestamp;