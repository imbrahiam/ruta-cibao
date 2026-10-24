import { ORPCError } from "@orpc/client";
import type { ApiOutputs, OfflinePlace } from "@ruta/contracts";
import { getOfflineMeta } from "./store";

/**
 * A transport failure, not a server answer. oRPC turns every HTTP response
 * (including errors) into an `ORPCError` carrying a status; anything else
 * thrown by the fetch layer means the request never got an answer. React
 * Native and Expo's fetch disagree on the error class and message, so the
 * test is "not a server answer" rather than a message match.
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error instanceof ORPCError) return false;
  return (
    error instanceof TypeError ||
    /fetch|network|connect|offline|internet|timed? ?out/i.test(
      `${error.name} ${error.message}`,
    )
  );
}

/** Use only a validated, present snapshot after transport failure, never after a server rejection. */
export function withOfflineFallback<T, U, A extends unknown[]>(
  online: (...args: A) => Promise<T>,
  offline: () => Promise<U | null>,
): (...args: A) => Promise<(T | U) & { savedCopyAt?: string }> {
  return async (...args) => {
    try {
      return (await online(...args)) as T & { savedCopyAt?: string };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      const meta = await getOfflineMeta();
      if (!meta) throw error;
      const saved = await offline();
      if (saved === null) throw error;
      return Object.assign(saved as U & object, {
        savedCopyAt: meta.generatedAt,
      });
    }
  };
}

/** Offline snapshots deliberately omit private state and expiring photo URLs. */
export function offlinePlaceListItem(
  place: OfflinePlace,
): ApiOutputs["places"]["browse"]["items"][number] {
  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    description: place.description,
    imageUrl: place.imageUrl,
    categoryId: place.category.id,
    categoryName: place.category.name,
    categoryIcon: place.category.icon,
    categoryColor: place.category.color,
    municipalityName: place.municipality.name,
  };
}
