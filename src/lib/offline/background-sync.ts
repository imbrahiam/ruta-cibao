/**
 * Asking the browser to finish the job after the tab is gone.
 *
 * The queue drains when a page is open and the connection returns. Background
 * Sync covers the other case — the report was filed in a dead zone, the phone
 * went in a pocket, and signal came back an hour later with the app closed.
 * Chrome on Android fires the service worker's `sync` event when connectivity
 * returns, and the worker replays the queue itself.
 *
 * Safari has no Background Sync, so there the queue still waits for the next
 * open. Nothing is lost either way; this only shortens the wait where it can.
 */
export const OFFLINE_SYNC_TAG = "ruta-cibao-offline-flush";

type SyncRegistration = ServiceWorkerRegistration & {
  sync?: { register(tag: string): Promise<void> };
};

export async function requestBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return;
  try {
    const registration = (await navigator.serviceWorker
      .ready) as SyncRegistration;
    await registration.sync?.register(OFFLINE_SYNC_TAG);
  } catch {
    // Denied or unsupported: the next open of the app sends the queue instead.
  }
}
