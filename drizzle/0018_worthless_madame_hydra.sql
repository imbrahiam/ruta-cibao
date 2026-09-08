CREATE TABLE "roads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"kind" text NOT NULL,
	"path" geometry(LineString,4326) NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "roads_path_idx" ON "roads" USING gist ("path");