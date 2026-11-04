CREATE TABLE "consultation_photo_uploads" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"consultation_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"content_type" text NOT NULL,
	"final_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"temporary_deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "consultation_photo_uploads" ADD CONSTRAINT "consultation_photo_uploads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_photo_uploads" ADD CONSTRAINT "consultation_photo_uploads_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_photo_uploads_user_request_idx" ON "consultation_photo_uploads" USING btree ("user_id","request_id");--> statement-breakpoint
CREATE INDEX "consultation_photo_uploads_expiry_idx" ON "consultation_photo_uploads" USING btree ("expires_at");