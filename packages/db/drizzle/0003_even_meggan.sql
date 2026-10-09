CREATE TABLE "styles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"reference" jsonb NOT NULL,
	"key_visual_prompt" text,
	"images" text[] DEFAULT '{}' NOT NULL,
	"key_visual" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
