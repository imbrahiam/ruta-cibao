CREATE TABLE "offline_snapshots" (
  "version" text PRIMARY KEY,
  "schema_version" integer NOT NULL DEFAULT 1,
  "storage_key" text NOT NULL UNIQUE,
  "sha256" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "generated_at" timestamptz NOT NULL DEFAULT now(),
  "is_current" boolean NOT NULL DEFAULT false,
  "revoked_at" timestamptz,
  "revoked_reason" text
);
--> statement-breakpoint
CREATE INDEX "offline_snapshots_current_idx" ON "offline_snapshots" ("is_current", "generated_at");
