import type { ApiOutputs, OfflinePlace } from "@ruta/contracts";
import { getOfflineMeta } from "./store";

/** oRPC's fetch transport preserves fetch rejections; HTTP/domain errors are not offline failures. */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /fetch|network|load failed|internet connection/i.test(error.message)
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
