ALTER TABLE "jobs" ADD COLUMN "mark" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "marked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "jobs_mark_idx" ON "jobs" USING btree ("mark");