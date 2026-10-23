ALTER TABLE "member_profiles" ADD COLUMN "staff_municipality_id" text;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD COLUMN "residency_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD COLUMN "residency_verified_by_user_id" text;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_staff_municipality_id_municipalities_id_fk" FOREIGN KEY ("staff_municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_residency_verified_by_user_id_user_id_fk" FOREIGN KEY ("residency_verified_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Staff jurisdiction moves to its own column. Existing moderators keep the
-- municipality they were appointed for; one without any assignment loses the
-- role (fail closed) rather than gaining province-wide reach.
UPDATE "member_profiles" SET "staff_municipality_id" = "municipality_id" WHERE "staff_role" = 'moderator' AND "municipality_id" IS NOT NULL;--> statement-breakpoint
INSERT INTO "audit_events" ("action", "subject_type", "subject_id", "metadata") SELECT 'staff.revoked', 'member', "user_id", '{"reason":"missing_staff_municipality"}'::jsonb FROM "member_profiles" WHERE "staff_role" = 'moderator' AND "staff_municipality_id" IS NULL;--> statement-breakpoint
UPDATE "member_profiles" SET "staff_role" = 'none' WHERE "staff_role" = 'moderator' AND "staff_municipality_id" IS NULL;--> statement-breakpoint
-- The in-person resident badge carries over only where a municipal official
-- actually approved the person for the municipality they still have selected.
-- A civil-registry match alone was never an endorsement and grants nothing.
UPDATE "member_profiles" AS "profile" SET "residency_verified_at" = "review"."reviewed_at", "residency_verified_by_user_id" = "review"."reviewed_by_user_id" FROM (SELECT DISTINCT ON ("user_id") "user_id", "municipality_id", "reviewed_at", "reviewed_by_user_id" FROM "identity_reviews" WHERE "status" = 'approved' AND "reviewed_at" IS NOT NULL ORDER BY "user_id", "reviewed_at" DESC) AS "review" WHERE "review"."user_id" = "profile"."user_id" AND "review"."municipality_id" = "profile"."municipality_id" AND ("review"."reviewed_by_user_id" IS NULL OR "review"."reviewed_by_user_id" <> "profile"."user_id");--> statement-breakpoint
-- One verified account is one contribution: identity tiers no longer weigh.
UPDATE "place_confirmations" SET "weight" = 1 WHERE "weight" <> 1;--> statement-breakpoint
UPDATE "traffic_confirmations" SET "weight" = 1 WHERE "weight" <> 1;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_staff_scope_check" CHECK (("member_profiles"."staff_role" = 'moderator' and "member_profiles"."staff_municipality_id" is not null) or ("member_profiles"."staff_role" <> 'moderator' and "member_profiles"."staff_municipality_id" is null));