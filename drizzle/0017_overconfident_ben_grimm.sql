CREATE TYPE "public"."traffic_severity" AS ENUM('blocking', 'partial', 'minor');--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "severity" "traffic_severity";