-- Stored notification links move from the retired web routes to the canonical
-- `/s/<kind>/<ref>` targets the native app and share pages understand.
UPDATE "notifications"
SET "href" = '/s/place/' || substring("href" from '^/mapa\?lugar=([^&]+)')
WHERE "href" ~ '^/mapa\?lugar=';
--> statement-breakpoint
UPDATE "notifications"
SET "href" = '/s/traffic/' || substring("href" from '^/mapa\?reporte=([^&]+)')
WHERE "href" ~ '^/mapa\?reporte=';
--> statement-breakpoint
UPDATE "notifications"
SET "href" = '/s/consultation/' || substring("href" from '^/consultas/([^/?#]+)')
WHERE "href" ~ '^/consultas/';
--> statement-breakpoint
UPDATE "notifications"
SET "href" = '/s/route/' || substring("href" from 'ruta=([^&]+)')
WHERE "href" ~ '^/rutas\?.*ruta=';
--> statement-breakpoint
UPDATE "notifications"
SET "href" = '/s/report/' || substring("href" from '^/informes/([^/?#]+)')
WHERE "href" ~ '^/informes/';
--> statement-breakpoint
UPDATE "notifications" SET "href" = '/contributions' WHERE "href" = '/aportes';
