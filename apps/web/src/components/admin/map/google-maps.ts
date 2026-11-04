/// <reference types="google.maps" />

/**
 * Loads the Google Maps JavaScript API, once, on the first map that mounts.
 *
 * No library is added: the loader is one script tag with the async bootstrap,
 * and nothing is requested on pages that never show a map. The key is the
 * browser one (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`), restricted by referrer in
 * the Google console.
 */
export type MapsFailure = "no-key" | "blocked";

export class MapsUnavailableError extends Error {
  constructor(readonly reason: MapsFailure) {
    super(`Google Maps unavailable: ${reason}`);
  }
}

const LOAD_TIMEOUT_MS = 15_000;

type Libraries = {
  maps: google.maps.MapsLibrary;
  core: google.maps.CoreLibrary;
};

let loading: Promise<Libraries> | undefined;
let authFailed = false;
const authListeners = new Set<() => void>();

declare global {
  interface Window {
    gm_authFailure?: () => void;
    __rutaMapsReady?: () => void;
  }
}

/** Fires when Google rejects the key (referrer, billing or API disabled). */
export function onMapsAuthFailure(listener: () => void): () => void {
  if (authFailed) listener();
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

export function loadGoogleMaps(): Promise<Libraries> {
  if (loading) return loading;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new MapsUnavailableError("no-key"));

  const {
    promise: attempt,
    resolve,
    reject,
  } = Promise.withResolvers<Libraries>();

  window.gm_authFailure = () => {
    authFailed = true;
    for (const listener of authListeners) listener();
  };

  const timer = setTimeout(
    () => reject(new MapsUnavailableError("blocked")),
    LOAD_TIMEOUT_MS,
  );

  window.__rutaMapsReady = () => {
    Promise.all([
      google.maps.importLibrary("maps"),
      google.maps.importLibrary("core"),
    ]).then(
      ([maps, core]) => {
        clearTimeout(timer);
        resolve({ maps, core });
      },
      () => {
        clearTimeout(timer);
        reject(new MapsUnavailableError("blocked"));
      },
    );
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
    key,
    v: "weekly",
    loading: "async",
    language: "es",
    region: "DO",
    callback: "__rutaMapsReady",
  })}`;
  script.onerror = () => {
    clearTimeout(timer);
    reject(new MapsUnavailableError("blocked"));
  };
  document.head.append(script);

  // A failed load may be retried (ad blocker lifted, network back).
  loading = attempt.catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

/**
 * An HTML element pinned to a coordinate, drawn above the map's tiles.
 *
 * Advanced markers need a cloud `mapId`, and a cloud map ignores the JSON
 * style that carries the app's palette, so markers are plain DOM instead:
 * real buttons with accessible names, themed with the desk's own CSS.
 */
export type MarkerOverlay = google.maps.OverlayView & {
  setPosition(position: google.maps.LatLngLiteral): void;
  setZIndex(zIndex: number): void;
};

let overlayClass:
  | (new (
      element: HTMLElement,
      position: google.maps.LatLngLiteral,
      zIndex: number,
    ) => MarkerOverlay)
  | undefined;

/** Defined lazily: `google.maps.OverlayView` exists only after the load. */
export function createMarkerOverlay(
  element: HTMLElement,
  position: google.maps.LatLngLiteral,
  zIndex: number,
): MarkerOverlay {
  overlayClass ??= class extends google.maps.OverlayView {
    constructor(
      private readonly element: HTMLElement,
      private position: google.maps.LatLngLiteral,
      private zIndex: number,
    ) {
      super();
      element.style.position = "absolute";
      // The spot is the element's centre, whatever its size. An absolutely
      // positioned box inside a zero-width pane would otherwise shrink to its
      // narrowest content and shift the centre.
      element.style.transform = "translate(-50%, -50%)";
      element.style.width = "max-content";
      element.style.height = "max-content";
    }

    override onAdd() {
      this.getPanes()?.overlayMouseTarget.append(this.element);
    }

    override onRemove() {
      this.element.remove();
    }

    override draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.element.style.left = `${point.x}px`;
      this.element.style.top = `${point.y}px`;
      this.element.style.zIndex = String(this.zIndex);
    }

    setPosition(position: google.maps.LatLngLiteral) {
      this.position = position;
      this.draw();
    }

    setZIndex(zIndex: number) {
      this.zIndex = zIndex;
      this.draw();
    }
  };
  return new overlayClass(element, position, zIndex);
}
