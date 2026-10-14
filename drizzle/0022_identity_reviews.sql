CREATE TYPE "public"."identity_review_reason" AS ENUM('unreadable', 'mismatch', 'not_resident', 'incomplete', 'other');--> statement-breakpoint
CREATE TYPE "public"."identity_review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."cedula_status" ADD VALUE 'matched';--> statement-breakpoint
ALTER TYPE "public"."cedula_status" ADD VALUE 'in_review';--> statement-breakpoint
CREATE TABLE "identity_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"municipality_id" text NOT NULL,
	"status" "identity_review_status" DEFAULT 'pending' NOT NULL,
	"front_key" text NOT NULL,
	"selfie_key" text NOT NULL,
	"residence_key" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	"reason" "identity_review_reason",
	"note" text,
	"documents_purged_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "identity_reviews" ADD CONSTRAINT "identity_reviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_reviews" ADD CONSTRAINT "identity_reviews_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_reviews" ADD CONSTRAINT "identity_reviews_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_reviews_queue_idx" ON "identity_reviews" USING btree ("status","municipality_id","submitted_at");--> statement-breakpoint
CREATE INDEX "identity_reviews_user_idx" ON "identity_reviews" USING btree ("user_id","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_reviews_one_open_idx" ON "identity_reviews" USING btree ("user_id") WHERE "identity_reviews"."status" = 'pending';