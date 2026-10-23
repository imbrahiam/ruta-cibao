CREATE TABLE "account_deletions" (
  "id" uuid PRIMARY KEY,
  "user_id" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','completed')),
  "inventory_ciphertext" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  CONSTRAINT "account_deletions_inventory_check" CHECK (("status" = 'pending' AND "inventory_ciphertext" IS NOT NULL) OR ("status" = 'completed' AND "inventory_ciphertext" IS NULL))
);
--> statement-breakpoint
CREATE INDEX "account_deletions_status_idx" ON "account_deletions" ("status");
