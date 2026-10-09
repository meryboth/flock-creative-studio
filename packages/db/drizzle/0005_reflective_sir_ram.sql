CREATE TYPE "public"."change_set_status" AS ENUM('proposed', 'applied', 'discarded', 'reverted', 'failed');--> statement-breakpoint
CREATE TABLE "change_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"message" text NOT NULL,
	"piece_file" text,
	"reply" text,
	"operations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_scope" text,
	"scope" jsonb,
	"status" "change_set_status" DEFAULT 'proposed' NOT NULL,
	"before" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "overrides" jsonb;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_sets_event_id_index" ON "change_sets" USING btree ("event_id");