CREATE TABLE "mail_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"from_addr" text NOT NULL,
	"subject" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"html" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parsed_at" timestamp with time zone,
	"parser" text,
	"jobs_found" integer
);
--> statement-breakpoint
CREATE INDEX "mail_messages_parsed_at_idx" ON "mail_messages" USING btree ("parsed_at");