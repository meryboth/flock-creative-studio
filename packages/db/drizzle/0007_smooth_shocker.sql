ALTER TABLE "scheduled_posts" ALTER COLUMN "moment" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "piece_label" text;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "published_via" text;