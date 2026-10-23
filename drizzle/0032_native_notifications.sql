CREATE TABLE "native_push_devices" (
  "installation_id" uuid PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "platform" text NOT NULL CHECK ("platform" IN ('ios','android')),
  "token_ciphertext" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "native_push_devices_user_idx" ON "native_push_devices" ("user_id", "enabled");
--> statement-breakpoint
CREATE TABLE "native_push_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "notification_id" uuid NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
  "installation_id" uuid NOT NULL REFERENCES "native_push_devices"("installation_id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expo_ticket_id" text UNIQUE,
  "status" text NOT NULL CHECK ("status" IN ('pending','ok','error')),
  "error_code" text,
  "check_after" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "native_push_tickets_delivery_idx" ON "native_push_tickets" ("notification_id","installation_id","token_hash");
--> statement-breakpoint
CREATE INDEX "native_push_tickets_receipt_idx" ON "native_push_tickets" ("status","check_after");
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "municipality_ids" text[] NOT NULL DEFAULT '{}',
  "category_ids" text[] NOT NULL DEFAULT '{}',
  "traffic_enabled" boolean NOT NULL DEFAULT false,
  "case_updates_enabled" boolean NOT NULL DEFAULT true,
  "email_enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "notification_preferences_municipalities_limit" CHECK (cardinality("municipality_ids") <= 3)
);
--> statement-breakpoint
-- Browser capabilities are deliberately retired rather than retained as a second delivery client.
DROP TABLE "push_subscriptions";
