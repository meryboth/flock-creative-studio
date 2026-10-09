CREATE TYPE "public"."publish_channel" AS ENUM('slack', 'linkedin');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('scheduled', 'publishing', 'published', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"channel" "publish_channel" NOT NULL,
	"moment" text NOT NULL,
	"piece_file" text NOT NULL,
	"text" text NOT NULL,
	"target" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "schedule_status" DEFAULT 'scheduled' NOT NULL,
	"external_url" text,
	"error" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_posts_event_id_index" ON "scheduled_posts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "scheduled_posts_status_scheduled_at_index" ON "scheduled_posts" USING btree ("status","scheduled_at");