/**
 * The province's basemap, kept on the phone.
 *
 * The MapLibre renderer draws its ground from one PMTiles file served from this
 * origin, about nine megabytes for the whole province at street level. Saving
 * that file in the Cache Storage is what turns "the app opens in a dead zone"
 * into "the map works in a dead zone": the service worker answers the
 * renderer's range requests from the saved copy, and no tile is ever fetched.
 *
 * Only on request. Nine megabytes is a decision on a metered rural plan, so the
 * person taps to download, sees how much it is first, and can remove it later.
 * Google's tiles and OSM's standard raster tiles may not be bulk downloaded
 * for offline use — which is one of the reasons the self-hosted basemap exists.
 */
export const BASEMAP_CACHE = "ruta-cibao-basemap-v1";

/** Whether the configured basemap is one this origin serves, and may store. */
export function storableBasemapUrl(
  url: string | undefined,
): string | undefined {
  if (!url || typeof window === "undefined") return;
  try {
    const resolved = new URL(url, window.location.href);
    if (resolved.origin !== window.location.origin) return;
    // The marker lets the service worker distinguish an intentional offline
    // archive from the much larger display archive without bundling env state.
    resolved.searchParams.set("offline", "1");
    return resolved.href;
  } catch {
    return;
  }
}

export function basemapStorageSupported(): boolean {
  return typeof caches !== "undefined";
}

export async function isBasemapSaved(url: string): Promise<boolean> {
  if (!basemapStorageSupported()) return false;
  const cache = await caches.open(BASEMAP_CACHE);
  return (await cache.match(url)) !== undefined;
}

/** The download size, from a HEAD request, or null when the server hides it. */
export async function basemapSizeBytes(url: string): Promise<number | null> {
  const response = await fetch(url, { method: "HEAD" });
  if (!response.ok) return null;
  const length = Number(response.headers.get("content-length"));
  return Number.isFinite(length) && length > 0 ? length : null;
}

/**
 * Fetches the whole file — no Range header, so a complete 200 lands in the
 * cache and the worker can slice it for every range the renderer asks for.
 */
export async function saveBasemap(url: string): Promise<void> {
  const cache = await caches.open(BASEMAP_CACHE);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || response.status !== 200) {
    throw new Error(`basemap responded ${response.status}`);
  }
  await cache.put(url, response);
}

export async function removeBasemap(url: string): Promise<void> {
  if (!basemapStorageSupported()) return;
  const cache = await caches.open(BASEMAP_CACHE);
  await cache.delete(url);
}

export function formatMegabytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
}
