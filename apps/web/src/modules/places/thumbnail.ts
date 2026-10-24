import { sql } from "drizzle-orm";
import { placePhotos, places } from "@/db/schema";
import { imageUrl } from "@/lib/storage";

/** Seeded images and published app photographs always take precedence. */
export const appThumbnailKey = sql<string | null>`coalesce(${places.imageUrl}, (
  select ${placePhotos.storageKey} from ${placePhotos}
  where ${placePhotos.placeId} = ${places.id} and ${placePhotos.status} = 'published'
  order by ${placePhotos.createdAt}, ${placePhotos.id} limit 1
))`;

export const thumbnailSelection = {
  appThumbnailKey,
  googlePlaceId: places.googlePlaceId,
};

export async function placeThumbnail(place: {
  id: string;
  appThumbnailKey: string | null;
  googlePlaceId: string | null;
}): Promise<{
  thumbnailUrl: string | null;
  thumbnailSource: "app" | "google" | null;
}> {
  if (place.appThumbnailKey) {
    const key = place.appThumbnailKey;
    return {
      thumbnailUrl: /^https?:\/\//.test(key)
        ? key
        : await imageUrl(key, { width: 480, height: 480 }),
      thumbnailSource: "app",
    };
  }
  return place.googlePlaceId
    ? {
        thumbnailUrl: `/api/places/${place.id}/thumbnail`,
        thumbnailSource: "google",
      }
    : { thumbnailUrl: null, thumbnailSource: null };
}
