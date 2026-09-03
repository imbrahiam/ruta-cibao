CREATE TYPE "public"."category_kind" AS ENUM('place', 'business', 'route', 'traffic', 'consultation');--> statement-breakpoint
CREATE TYPE "public"."place_status" AS ENUM('draft', 'pending', 'published', 'rejected', 'archived');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "category_kind" NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'map-pin' NOT NULL,
	"color" text DEFAULT '#166534' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" text NOT NULL,
	"municipality_id" text NOT NULL,
	"location" geometry(point) NOT NULL,
	"address" text,
	"status" "place_status" DEFAULT 'pending' NOT NULL,
	"created_by_user_id" text,
	"reviewed_by_user_id" text,
	"review_note" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_kind_idx" ON "categories" USING btree ("kind","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_kind_name_idx" ON "categories" USING btree ("kind","name");--> statement-breakpoint
CREATE UNIQUE INDEX "places_slug_idx" ON "places" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "places_location_idx" ON "places" USING gist ("location");--> statement-breakpoint
CREATE INDEX "places_status_idx" ON "places" USING btree ("status","municipality_id");--> statement-breakpoint
CREATE INDEX "places_category_idx" ON "places" USING btree ("category_id");