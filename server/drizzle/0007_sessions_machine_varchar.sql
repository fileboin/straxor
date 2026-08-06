ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_machine_id_machines_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "machine_id" SET DATA TYPE varchar(255);
