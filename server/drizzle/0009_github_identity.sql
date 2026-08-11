ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_id" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_login" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_avatar" varchar(512);
CREATE UNIQUE INDEX IF NOT EXISTS "users_github_id_unique" ON "users" ("github_id");