CREATE TABLE "passport_stamps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"place_blind_index" text NOT NULL,
	"place_id" text NOT NULL,
	"stamped_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passport_stamps" ADD CONSTRAINT "passport_stamps_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "passport_stamps_user_place_idx" ON "passport_stamps" USING btree ("user_id","place_blind_index");--> statement-breakpoint
CREATE INDEX "passport_stamps_user_date_idx" ON "passport_stamps" USING btree ("user_id","stamped_at","id");