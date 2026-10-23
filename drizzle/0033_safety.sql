CREATE TYPE "publication_status" AS ENUM ('pending', 'published', 'hidden');
--> statement-breakpoint
-- Everything that exists today was already public: backfill as published, then default new rows to pending.
ALTER TABLE "consultations" ADD COLUMN "publication_status" "publication_status" NOT NULL DEFAULT 'published';
--> statement-breakpoint
ALTER TABLE "consultations" ALTER COLUMN "publication_status" SET DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "traffic_reports" ADD COLUMN "description_moderation_status" "publication_status" NOT NULL DEFAULT 'published';
--> statement-breakpoint
ALTER TABLE "traffic_reports" ALTER COLUMN "description_moderation_status" SET DEFAULT 'pending';
--> statement-breakpoint
CREATE INDEX "consultations_publication_idx" ON "consultations" ("publication_status", "municipality_id");
--> statement-breakpoint
CREATE TABLE "content_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reporter_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "subject_kind" text NOT NULL CHECK ("subject_kind" IN ('place','photo','route','traffic','consultation')),
  "subject_ref" text NOT NULL,
  "author_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "municipality_id" text NOT NULL REFERENCES "municipalities"("id"),
  "reason" text NOT NULL CHECK ("reason" IN ('abuse','personal_information','unsafe','other')),
  "details" text CHECK ("details" IS NULL OR char_length("details") <= 500),
  "status" text NOT NULL DEFAULT 'open' CHECK ("status" IN ('open','actioned','dismissed')),
  "decision_reason" text,
  "reviewed_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "content_reports_queue_idx" ON "content_reports" ("status", "municipality_id", "created_at");
--> statement-breakpoint
CREATE INDEX "content_reports_subject_idx" ON "content_reports" ("subject_kind", "subject_ref");
--> statement-breakpoint
CREATE UNIQUE INDEX "content_reports_open_idx" ON "content_reports" ("reporter_user_id", "subject_kind", "subject_ref") WHERE "status" = 'open';
--> statement-breakpoint
CREATE TABLE "user_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "blocking_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "blocked_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_blocks_not_self" CHECK ("blocking_user_id" <> "blocked_user_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_blocks_pair_idx" ON "user_blocks" ("blocking_user_id", "blocked_user_id");
--> statement-breakpoint
CREATE INDEX "user_blocks_blocked_idx" ON "user_blocks" ("blocked_user_id");
