ALTER TABLE "git_connections" ADD COLUMN "connection_type" varchar(20) DEFAULT 'token' NOT NULL;--> statement-breakpoint
ALTER TABLE "repo_connections" ADD COLUMN "connection_type" varchar(20) DEFAULT 'token' NOT NULL;
