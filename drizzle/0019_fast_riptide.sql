CREATE TYPE "public"."route_difficulty" AS ENUM('easy', 'moderate', 'hard');--> statement-breakpoint
CREATE TYPE "public"."route_status" AS ENUM('pending', 'published', 'rejected');--> statement-breakpoint
CREATE TABLE "eco_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category_id" text NOT NULL,
	"municipality_id" text NOT NULL,
	"path" geometry(LineString,4326) NOT NULL,
	"distance_meters" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"difficulty" "route_difficulty" NOT NULL,
	"services" text[] DEFAULT '{}' NOT NULL,
	"status" "route_status" DEFAULT 'pending' NOT NULL,
	"submitted_by_user_id" text,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eco_routes" ADD CONSTRAINT "eco_routes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eco_routes" ADD CONSTRAINT "eco_routes_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eco_routes" ADD CONSTRAINT "eco_routes_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eco_routes_path_idx" ON "eco_routes" USING gist ("path");--> statement-breakpoint
CREATE INDEX "eco_routes_browse_idx" ON "eco_routes" USING btree ("status","municipality_id");