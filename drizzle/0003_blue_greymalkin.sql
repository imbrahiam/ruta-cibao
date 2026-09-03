CREATE TABLE "realtime_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"municipality_id" text,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"location" geometry(point),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "realtime_events" ADD CONSTRAINT "realtime_events_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "realtime_events_channel_idx" ON "realtime_events" USING btree ("channel","id");--> statement-breakpoint
CREATE INDEX "realtime_events_created_idx" ON "realtime_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "realtime_events_location_idx" ON "realtime_events" USING gist ("location");--> statement-breakpoint
-- The nudge. Fires after commit, so a listener that reacts immediately always
-- finds the row already visible. The payload is just the id: NOTIFY caps at
-- 8000 bytes, and the row is the source of truth anyway.
CREATE OR REPLACE FUNCTION notify_realtime_event() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('realtime_event', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS realtime_events_notify ON realtime_events;
--> statement-breakpoint
CREATE TRIGGER realtime_events_notify
  AFTER INSERT ON realtime_events
  FOR EACH ROW EXECUTE FUNCTION notify_realtime_event();
