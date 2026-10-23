ALTER TABLE "photo_uploads" ADD COLUMN "request_id" uuid;
--> statement-breakpoint
ALTER TABLE "photo_uploads" ADD COLUMN "request_hash" text;
--> statement-breakpoint
ALTER TABLE "photo_uploads" ADD COLUMN "temporary_deleted_at" timestamptz;
--> statement-breakpoint
-- Existing reservations predate client request IDs; keep their capabilities usable.
UPDATE "photo_uploads" SET "request_id" = gen_random_uuid(), "request_hash" = 'legacy:' || "storage_key";
--> statement-breakpoint
ALTER TABLE "photo_uploads" ALTER COLUMN "request_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "photo_uploads" ALTER COLUMN "request_hash" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "photo_uploads_user_request_idx" ON "photo_uploads" ("user_id", "request_id");
