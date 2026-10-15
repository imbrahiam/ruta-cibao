import { and, count, desc, eq, gt, gte, isNotNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { PLACES_GEOJSON_TAG } from "@/app/api/places/geojson/route";
import { db } from "@/db";
import {
  categories,
  ecoRoutes,
  municipalities,
  places,
  trafficReports,
} from "@/db/schema";
import { TIME_ZONE } from "@/i18n/config";
import { PROVINCE_BOUNDS } from "@/lib/map/config";
import { browsePlaces } from "@/modules/places/discover";
import { project, territoryFrame } from "./frame";

/**
 * What the landing page knows about the province, read straight from the
 * database. Every number on the page comes from here; nothing is a constant.
 *
 * Three functions because the three answers age at different speeds — a
 * blocked road is stale in minutes, a published place in hours, a municipal
 * border in years — and each cache lifetime says so. Callers sit behind
 * `connection()`, so none of this runs during a build without a database.
 */

/** The drawing is this many units wide; the height follows the province. */
export const TERRITORY_WIDTH = 400;

/**
 * The dam is the province's best-known landmark and the drawing marks it.
 *
 * Found by its slug rather than a category, because there is no "presa"
 * category and inventing one for a single row would be the wrong fix. If the
 * place is ever unpublished the mark simply disappears.
 */
const DAM_SLUG = "presa-de-moncion";

/** Midnight at the start of this month / this week, in the province's clock. */
const startOfMonth = sql`(date_trunc('month', now() at time zone ${TIME_ZONE}) at time zone ${TIME_ZONE})`;
const startOfWeek = sql`(date_trunc('week', now() at time zone ${TIME_ZONE}) at time zone ${TIME_ZONE})`;

/**
 * Live counts and the roads that are closed right now.
 *
 * A minute of staleness is fine for a home page and saves a query per visit;
 * anything longer and the notice bar could announce a road that reopened.
 */
export async function landingPulse() {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const live = and(
    eq(trafficReports.status, "active"),
    gt(trafficReports.expiresAt, sql`now()`),
  );

  const [
    [placeCount],
    [routeCount],
    [resolvedMonth],
    [resolvedWeek],
    open,
    blocked,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(places)
      .where(eq(places.status, "published")),
    db
      .select({ value: count() })
      .from(ecoRoutes)
      .where(eq(ecoRoutes.status, "published")),
    db
      .select({ value: count() })
      .from(trafficReports)
      .where(
        and(
          eq(trafficReports.status, "cleared"),
          gte(trafficReports.resolvedAt, startOfMonth),
        ),
      ),
    db
      .select({ value: count() })
      .from(trafficReports)
      .where(
        and(
          eq(trafficReports.status, "cleared"),
          gte(trafficReports.resolvedAt, startOfWeek),
        ),
      ),
    db
      .select({
        id: trafficReports.id,
        severity: categories.severity,
        longitude: sql<number>`ST_X(${trafficReports.location})`,
        latitude: sql<number>`ST_Y(${trafficReports.location})`,
      })
      .from(trafficReports)
      .innerJoin(categories, eq(categories.id, trafficReports.categoryId))
      .where(live),
    db
      .select({
        id: trafficReports.id,
        category: categories.name,
        municipality: municipalities.name,
        createdAt: trafficReports.createdAt,
      })
      .from(trafficReports)
      .innerJoin(categories, eq(categories.id, trafficReports.categoryId))
      .innerJoin(
        municipalities,
        eq(municipalities.id, trafficReports.municipalityId),
      )
      .where(and(live, eq(categories.severity, "blocking")))
      .orderBy(desc(trafficReports.createdAt)),
  ]);

  const frame = territoryFrame(PROVINCE_BOUNDS, TERRITORY_WIDTH);

  return {
    places: placeCount?.value ?? 0,
    routes: routeCount?.value ?? 0,
    resolvedThisMonth: resolvedMonth?.value ?? 0,
    resolvedThisWeek: resolvedWeek?.value ?? 0,
    open: open.map((report) => ({
      id: report.id,
      blocking: report.severity === "blocking",
      ...project(frame, Number(report.longitude), Number(report.latitude)),
    })),
    blocked: blocked.map((report) => ({
      ...report,
      createdAt: report.createdAt.toISOString(),
    })),
  };
}

export type LandingPulse = Awaited<ReturnType<typeof landingPulse>>;

/**
 * The three municipalities as SVG path data, plus where to pin their names.
 *
 * PostGIS does the drawing: translate to the frame's corner, scale, drop
 * vertices closer than a unit apart (invisible at this size, and two thirds of
 * the bytes), then `ST_AsSVG` with one decimal. About 12 KB for the province,
 * inline, so the section paints with the HTML and needs no request.
 */
export async function landingTerritory() {
  "use cache";
  // Administrative boundaries are redrawn by law, not by traffic.
  cacheLife("days");

  const frame = territoryFrame(PROVINCE_BOUNDS, TERRITORY_WIDTH);

  const [rows, [dam]] = await Promise.all([
    db
      .select({
        id: municipalities.id,
        name: municipalities.name,
        path: sql<string>`ST_AsSVG(
          ST_RemoveRepeatedPoints(
            ST_Scale(
              ST_Translate(${municipalities.boundary}, ${-frame.west}::float8, ${-frame.north}::float8),
              ${frame.scaleX}::float8, ${frame.scaleY}::float8
            ),
            1.0
          ),
          0, 1
        )`,
        longitude: sql<number>`ST_X(ST_PointOnSurface(${municipalities.boundary}))`,
        latitude: sql<number>`ST_Y(ST_PointOnSurface(${municipalities.boundary}))`,
      })
      .from(municipalities)
      .where(isNotNull(municipalities.boundary))
      .orderBy(municipalities.name),
    db
      .select({
        name: places.name,
        slug: places.slug,
        longitude: sql<number>`ST_X(${places.location})`,
        latitude: sql<number>`ST_Y(${places.location})`,
      })
      .from(places)
      .where(and(eq(places.slug, DAM_SLUG), eq(places.status, "published")))
      .limit(1),
  ]);

  return {
    width: frame.width,
    height: Math.round(frame.height * 10) / 10,
    municipalities: rows.map((row) => ({
      id: row.id,
      name: row.name,
      path: row.path,
      label: project(frame, Number(row.longitude), Number(row.latitude)),
    })),
    dam: dam
      ? {
          name: dam.name,
          slug: dam.slug,
          ...project(frame, Number(dam.longitude), Number(dam.latitude)),
        }
      : null,
  };
}

export type LandingTerritory = Awaited<ReturnType<typeof landingTerritory>>;

/**
 * Places worth a visit: published ones, those with a photo first.
 *
 * Tagged with the map's own tag so a moderator approving a place refreshes
 * this row in the same breath as the map.
 */
export async function landingPlaces() {
  "use cache";
  cacheTag(PLACES_GEOJSON_TAG);
  cacheLife("hours");

  const { items } = await browsePlaces({
    query: "",
    category: "",
    municipality: "",
    offset: 0,
    limit: 12,
  });
  // "Para visitar" is the places someone goes to for the going — a river, a
  // park, somewhere to eat or stay — not the town hall or the hospital, which
  // the map and Explorar still carry. If the province has too few of those
  // yet, the row falls back to everything rather than showing one card.
  const visitable = items.filter(
    (item) => !SERVICE_CATEGORIES.has(item.categoryId),
  );
  return (visitable.length >= 3 ? visitable : items).toSorted(
    (a, b) => Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)),
  );
}

/** Categories that are services rather than outings. */
const SERVICE_CATEGORIES = new Set([
  "salud",
  "gobierno",
  "educacion",
  "transporte",
]);

export type LandingPlace = Awaited<ReturnType<typeof landingPlaces>>[number];
