ALTER TABLE "places" ADD COLUMN "google_place_id" text;
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "google_place_checked_at" timestamp with time zone;
