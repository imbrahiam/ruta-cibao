CREATE TYPE "public"."place_photo_status" AS ENUM('pending', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."place_verdict" AS ENUM('exists', 'gone');--> statement-breakpoint
CREATE TABLE "place_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"verdict" "place_verdict" NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"uploaded_by_user_id" text,
	"storage_key" text NOT NULL,
	"status" "place_photo_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place_confirmations" ADD CONSTRAINT "place_confirmations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_confirmations" ADD CONSTRAINT "place_confirmations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_photos" ADD CONSTRAINT "place_photos_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_photos" ADD CONSTRAINT "place_photos_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_photos" ADD CONSTRAINT "place_photos_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "place_confirmations_place_user_idx" ON "place_confirmations" USING btree ("place_id","user_id");--> statement-breakpoint
CREATE INDEX "place_confirmations_place_idx" ON "place_confirmations" USING btree ("place_id","verdict");--> statement-breakpoint
CREATE UNIQUE INDEX "place_photos_key_idx" ON "place_photos" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "place_photos_place_idx" ON "place_photos" USING btree ("place_id","status");