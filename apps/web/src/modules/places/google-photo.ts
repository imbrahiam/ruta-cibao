import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { municipalities, places } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { appThumbnailKey } from "./thumbnail";

const MAX_MATCH_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const searchResponse = z.object({
  places: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]+$/),
        displayName: z
          .object({ text: z.string(), languageCode: z.string().optional() })
          .optional(),
        location: z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        }),
      }),
    )
    .optional(),
});
const detailsResponse = z.object({
  photos: z
    .array(
      z.object({
        name: z
          .string()
          .regex(/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/),
        authorAttributions: z
          .array(z.object({ displayName: z.string() }))
          .optional(),
      }),
    )
    .optional(),
});
const mediaResponse = z.object({
  photoUri: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "googleusercontent.com" ||
        url.hostname.endsWith(".googleusercontent.com") ||
        url.hostname === "ggpht.com" ||
        url.hostname.endsWith(".ggpht.com") ||
        url.hostname === "google.com" ||
        url.hostname.endsWith(".google.com"))
    );
  }),
});

async function googleJson(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`https://places.googleapis.com/v1/${path}`, {
    ...init,
    headers: {
      "X-Goog-Api-Key": env.GOOGLE_MAPS_SERVER_API_KEY ?? "",
      ...init.headers,
    },
    signal: AbortSignal.timeout(6_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google Places request failed.");
  return response.json();
}

/** Great-circle distance, in metres; a text match alone is not geographic evidence. */
export function googleMatchDistance(
  origin: { x: number; y: number },
  target: { longitude: number; latitude: number },
): number {
  const radians = Math.PI / 180;
  const a =
    Math.sin(((target.latitude - origin.y) * radians) / 2) ** 2 +
    Math.cos(origin.y * radians) *
      Math.cos(target.latitude * radians) *
      Math.sin(((target.longitude - origin.x) * radians) / 2) ** 2;
  return (
    6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
  );
}

/** Cache only the permitted place ID, including negative checks for thirty days. */
export async function resolveGooglePlace(place: {
  id: string;
}): Promise<string | null> {
  if (!env.GOOGLE_MAPS_SERVER_API_KEY) return null;
  return db.transaction(async (tx) => {
    // Serialize checks for this place, including simultaneous public image requests.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`google-place:${place.id}`}))`,
    );
    const [row] = await tx
      .select({
        id: places.id,
        name: places.name,
        location: places.location,
        municipalityId: places.municipalityId,
        municipalityName: municipalities.name,
        googlePlaceId: places.googlePlaceId,
        checkedAt: places.googlePlaceCheckedAt,
        appThumbnailKey,
      })
      .from(places)
      .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
      .where(and(eq(places.id, place.id), eq(places.status, "published")))
      .limit(1);
    if (!row || row.appThumbnailKey) return null;
    if (
      row.checkedAt &&
      Date.now() - row.checkedAt.getTime() < MAX_MATCH_AGE_MS
    ) {
      return row.googlePlaceId;
    }
    const result = searchResponse.parse(
      await googleJson("places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-FieldMask": "places.id,places.displayName,places.location",
        },
        body: JSON.stringify({
          textQuery: `${row.name} ${row.municipalityName}`,
          locationBias: {
            circle: {
              center: { latitude: row.location.y, longitude: row.location.x },
              radius: 300,
            },
          },
          maxResultCount: 1,
          languageCode: "es",
        }),
      }),
    );
    const candidate = result.places?.[0];
    const id =
      candidate && googleMatchDistance(row.location, candidate.location) <= 250
        ? candidate.id
        : null;
    await tx
      .update(places)
      .set({ googlePlaceId: id, googlePlaceCheckedAt: new Date() })
      .where(eq(places.id, row.id));
    await recordAudit(
      {
        action: "places.google_match_checked",
        subjectType: "place",
        subjectId: row.id,
        municipalityId: row.municipalityId,
        metadata: { matched: id !== null },
      },
      tx,
    );
    return id;
  });
}

type GooglePhoto = { uri: string; attribution: string | null };

/**
 * The resolved photo address, held in this process's memory only for a few
 * hours: every thumbnail otherwise costs two Places calls, and the demo key's
 * daily quota runs out within one browse of the map. Nothing is persisted.
 */
const PHOTO_TTL_MS = 6 * 60 * 60 * 1000;
const photoCache = new Map<
  string,
  { photo: GooglePhoto | null; expires: number }
>();

/** Photo names and capabilities are fetched afresh, never persisted or proxied. */
export async function googlePlacePhoto(place: {
  id: string;
}): Promise<GooglePhoto | null> {
  const cached = photoCache.get(place.id);
  if (cached && cached.expires > Date.now()) return cached.photo;
  const id = await resolveGooglePlace(place);
  if (!id) return null;
  const details = detailsResponse.parse(
    await googleJson(`places/${encodeURIComponent(id)}?fields=photos`),
  );
  const first = details.photos?.[0];
  let photo: GooglePhoto | null = null;
  if (first) {
    const media = mediaResponse.parse(
      await googleJson(
        `${first.name}/media?maxWidthPx=480&skipHttpRedirect=true`,
      ),
    );
    photo = {
      uri: media.photoUri,
      attribution: first.authorAttributions?.[0]?.displayName ?? null,
    };
  }
  photoCache.set(place.id, { photo, expires: Date.now() + PHOTO_TTL_MS });
  return photo;
}
