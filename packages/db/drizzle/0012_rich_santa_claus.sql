ALTER TABLE "styles" ADD COLUMN "templates" jsonb;--> statement-breakpoint
ALTER TABLE "styles" ADD COLUMN "template_previews" text[] DEFAULT '{}' NOT NULL;