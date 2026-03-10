CREATE TABLE "glossary_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" text NOT NULL,
	"variations" text[],
	"definition" text NOT NULL,
	"category" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "glossary_terms_term_unique" UNIQUE("term")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "short_code" varchar(8);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "status" varchar(20) DEFAULT 'waiting' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "section_type" varchar(20);--> statement-breakpoint
CREATE INDEX "idx_glossary_terms_term" ON "glossary_terms" USING btree ("term");--> statement-breakpoint
CREATE INDEX "idx_glossary_terms_category" ON "glossary_terms" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_sessions_package_id" ON "sessions" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_short_code" ON "sessions" USING btree ("short_code");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_short_code_unique" UNIQUE("short_code");