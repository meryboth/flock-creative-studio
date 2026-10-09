ALTER TABLE "llm_calls" ADD COLUMN "prompt_id" text;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD COLUMN "prompt_version" integer;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD COLUMN "cost_usd" real;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "manual_minutes" real;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "machine_seconds" real;--> statement-breakpoint
CREATE INDEX "llm_calls_run_id_index" ON "llm_calls" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "llm_calls_event_id_index" ON "llm_calls" USING btree ("event_id");