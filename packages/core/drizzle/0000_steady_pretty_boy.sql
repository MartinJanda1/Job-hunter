CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"company" text,
	"location" text,
	"remote" boolean,
	"salary_text" text,
	"url" text NOT NULL,
	"description" text,
	"published_at" timestamp with time zone,
	"found_at" timestamp with time zone DEFAULT now() NOT NULL,
	"score" integer,
	"score_reason" text,
	"status" text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "jobs_status_found_at_idx" ON "jobs" USING btree ("status","found_at");