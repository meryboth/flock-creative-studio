CREATE TYPE "public"."direction_status" AS ENUM('proposed', 'selected', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('exploring', 'kit_locked', 'producing', 'done');--> statement-breakpoint
CREATE TYPE "public"."piece_status" AS ENUM('draft', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'waiting_human', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "agenda_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text,
	"title" text NOT NULL,
	"speaker" text,
	"room" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"area" text,
	"role" text,
	"photo" text
);
--> statement-breakpoint
CREATE TABLE "brand_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(768),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_kits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"manifest" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creative_directions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"parent_id" uuid,
	"round" integer DEFAULT 1 NOT NULL,
	"concept" text NOT NULL,
	"tokens" jsonb NOT NULL,
	"prompts" jsonb,
	"locked_fields" text[] DEFAULT '{}' NOT NULL,
	"status" "direction_status" DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_kits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"direction_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"kit" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"theme" text,
	"starts_at" timestamp with time zone,
	"location" text,
	"brief" text,
	"structured_brief" jsonb,
	"status" "event_status" DEFAULT 'exploring' NOT NULL,
	"brand_kit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"direction_id" uuid,
	"piece_id" uuid,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "font_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family" text NOT NULL,
	"role" text NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"license" text,
	"vibe" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "font_catalog_family_unique" UNIQUE("family")
);
--> statement-breakpoint
CREATE TABLE "key_visuals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction_id" uuid NOT NULL,
	"file" text NOT NULL,
	"mask_file" text,
	"prompt" text,
	"provider" text NOT NULL,
	"seed" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moodboard_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"file" text NOT NULL,
	"source" text,
	"analysis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"event_kit_id" uuid,
	"type" text NOT NULL,
	"template" text NOT NULL,
	"data" jsonb NOT NULL,
	"file" text,
	"version" integer DEFAULT 1 NOT NULL,
	"qa_score" real,
	"qa_report" jsonb,
	"status" "piece_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"node" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"duration_ms" integer,
	"tokens_in" integer,
	"tokens_out" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"graph" text NOT NULL,
	"thread_id" text NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_directions" ADD CONSTRAINT "creative_directions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_directions" ADD CONSTRAINT "creative_directions_parent_id_creative_directions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."creative_directions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_kits" ADD CONSTRAINT "event_kits_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_kits" ADD CONSTRAINT "event_kits_direction_id_creative_directions_id_fk" FOREIGN KEY ("direction_id") REFERENCES "public"."creative_directions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_brand_kit_id_brand_kits_id_fk" FOREIGN KEY ("brand_kit_id") REFERENCES "public"."brand_kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_direction_id_creative_directions_id_fk" FOREIGN KEY ("direction_id") REFERENCES "public"."creative_directions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_visuals" ADD CONSTRAINT "key_visuals_direction_id_creative_directions_id_fk" FOREIGN KEY ("direction_id") REFERENCES "public"."creative_directions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboard_images" ADD CONSTRAINT "moodboard_images_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_event_kit_id_event_kits_id_fk" FOREIGN KEY ("event_kit_id") REFERENCES "public"."event_kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agenda_items_event_id_index" ON "agenda_items" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "attendees_event_id_index" ON "attendees" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "brand_chunks_embedding_idx" ON "brand_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "creative_directions_event_id_index" ON "creative_directions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "moodboard_images_event_id_index" ON "moodboard_images" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "pieces_event_id_type_index" ON "pieces" USING btree ("event_id","type");--> statement-breakpoint
CREATE INDEX "run_steps_run_id_index" ON "run_steps" USING btree ("run_id");