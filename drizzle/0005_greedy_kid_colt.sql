-- Existing rows carry SRID 0, because drizzle-kit dropped the SRID from the
-- original DDL and Drizzle's built-in geometry type wrote points without one.
-- `USING ST_SetSRID(...)` stamps the coordinate system on the values already
-- stored as part of the same statement; without it Postgres refuses the type
-- change outright. The coordinates themselves are unchanged — they were always
-- WGS 84, the column just never said so.
ALTER TABLE "municipalities" ALTER COLUMN "boundary" SET DATA TYPE geometry(MultiPolygon,4326) USING ST_SetSRID("boundary", 4326);--> statement-breakpoint
ALTER TABLE "municipalities" ALTER COLUMN "center" SET DATA TYPE geometry(Point,4326) USING ST_SetSRID("center", 4326);--> statement-breakpoint
ALTER TABLE "places" ALTER COLUMN "location" SET DATA TYPE geometry(Point,4326) USING ST_SetSRID("location", 4326);--> statement-breakpoint
ALTER TABLE "realtime_events" ALTER COLUMN "location" SET DATA TYPE geometry(Point,4326) USING ST_SetSRID("location", 4326);