CREATE TYPE "public"."place_location_source" AS ENUM('map', 'gps');--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "location_source" "place_location_source" DEFAULT 'map' NOT NULL;