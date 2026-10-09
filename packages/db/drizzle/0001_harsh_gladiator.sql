ALTER TABLE "events" ADD COLUMN "date" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "language" text DEFAULT 'es' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "hashtag" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "style" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "moodboard" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "content" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "content_source" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "stage" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "total" integer DEFAULT 0 NOT NULL;