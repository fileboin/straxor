-- VPS je globalna i nezavisna od projekta: machines.project_id postaje nullable.
ALTER TABLE "machines" DROP CONSTRAINT IF EXISTS "machines_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "machines" ALTER COLUMN "project_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;