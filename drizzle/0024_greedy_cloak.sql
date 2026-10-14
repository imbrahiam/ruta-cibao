CREATE TABLE "photo_uploads" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"place_id" uuid NOT NULL,
	"size_bytes" integer NOT NULL,
	"content_type" text NOT NULL,
	"final_key" text,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photo_uploads" ADD CONSTRAINT "photo_uploads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_uploads" ADD CONSTRAINT "photo_uploads_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_uploads_user_idx" ON "photo_uploads" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "photo_uploads_expiry_idx" ON "photo_uploads" USING btree ("expires_at");