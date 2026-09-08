CREATE TYPE "public"."place_report_reason" AS ENUM('incorrect_information', 'closed', 'duplicate', 'wrong_location', 'other');--> statement-breakpoint
CREATE TYPE "public"."place_report_status" AS ENUM('pending', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "place_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"reporter_user_id" text,
	"reason" "place_report_reason" NOT NULL,
	"details" text,
	"status" "place_report_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "place_reports" ADD CONSTRAINT "place_reports_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_reports" ADD CONSTRAINT "place_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_reports_place_status_idx" ON "place_reports" USING btree ("place_id","status");--> statement-breakpoint
CREATE INDEX "place_reports_reporter_idx" ON "place_reports" USING btree ("reporter_user_id");