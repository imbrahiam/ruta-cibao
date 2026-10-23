-- Refuses to drop the identity tables while any review still references
-- stored document photos: those keys are the only way to delete the objects.
-- Run `bun run scripts/retire-identity.ts` first; it is idempotent.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "identity_reviews" WHERE "documents_purged_at" IS NULL) THEN RAISE EXCEPTION 'identity documents not purged: run scripts/retire-identity.ts before this migration'; END IF; END $$;--> statement-breakpoint
ALTER TABLE "identity_reviews" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "registry_lookups" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "identity_reviews" CASCADE;--> statement-breakpoint
DROP TABLE "registry_lookups" CASCADE;--> statement-breakpoint
DROP INDEX "member_profiles_cedula_idx";--> statement-breakpoint
DROP INDEX "member_profiles_tier_idx";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN "tier";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN "cedula_ciphertext";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN "cedula_blind_index";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN "cedula_status";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN "residency_declared_at";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN "verified_full_name";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN "claimed_name";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN "cedula_claimed_at";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN "verified_at";--> statement-breakpoint
DROP TYPE "public"."cedula_status";--> statement-breakpoint
DROP TYPE "public"."identity_review_reason";--> statement-breakpoint
DROP TYPE "public"."identity_review_status";--> statement-breakpoint
DROP TYPE "public"."member_tier";