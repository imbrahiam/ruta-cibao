CREATE TYPE "public"."staff_role" AS ENUM('none', 'moderator', 'admin');--> statement-breakpoint
ALTER TABLE "member_profiles" ADD COLUMN "staff_role" "staff_role" DEFAULT 'none' NOT NULL;--> statement-breakpoint
CREATE INDEX "member_profiles_staff_idx" ON "member_profiles" USING btree ("staff_role");