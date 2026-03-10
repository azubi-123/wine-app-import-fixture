CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "packages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"email" varchar(255),
	"display_name" varchar(100) NOT NULL,
	"is_host" boolean DEFAULT false,
	"progress_ptr" integer DEFAULT 0,
	"last_active" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid,
	"slide_id" uuid,
	"answer_json" jsonb NOT NULL,
	"answered_at" timestamp DEFAULT now(),
	"synced" boolean DEFAULT true,
	CONSTRAINT "responses_participant_id_slide_id_unique" UNIQUE("participant_id","slide_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"active_participants" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid,
	"position" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"payload_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_slide_id_slides_id_fk" FOREIGN KEY ("slide_id") REFERENCES "public"."slides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slides" ADD CONSTRAINT "slides_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_packages_code" ON "packages" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_participants_session" ON "participants" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_participants_email_session" ON "participants" USING btree ("email","session_id");--> statement-breakpoint
CREATE INDEX "idx_responses_participant" ON "responses" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "idx_responses_synced" ON "responses" USING btree ("synced");--> statement-breakpoint
CREATE INDEX "idx_slides_package_position" ON "slides" USING btree ("package_id","position");