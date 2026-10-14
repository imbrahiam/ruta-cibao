/**
 * The phone's own position, asked for the way browsers actually require.
 *
 * Three rules decide whether the permission sheet ever appears, and all three
 * are the browser's, not ours:
 *
 *   The page must be a secure context. Over plain `http://` — a phone pointed
 *   at a laptop's LAN address, which is exactly how this app gets tested —
 *   Safari and Chrome refuse without ever showing a prompt. That is not a
 *   refusal by the person, and telling them to check their permissions when
 *   they were never asked is how an afternoon disappears.
 *
 *   The call must happen in the same tick as the tap. Safari treats an `await`
 *   between the gesture and `getCurrentPosition` as losing the gesture, and
 *   silently drops the prompt. So this returns a promise but does nothing
 *   asynchronous before calling: the executor runs synchronously.
 *
 *   A prompt outside a gesture is not shown at all on iOS. Which is why
 *   `primePosition` only ever warms a fix that was already granted; the ask
 *   itself belongs to a button somebody pressed.
 */

export type Position = { lng: number; lat: number };

/**
 * Why there is no position — each one a different sentence to the person.
 *
 * `insecure` and `denied` look identical in the callback (`PERMISSION_DENIED`)
 * and could not be further apart: one is the browser refusing to ask, the
 * other is an answer.
 */
export type LocationProblem =
  | "insecure"
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout";

export type PositionResult =
  | { ok: true; position: Position; accuracyMeters: number; capturedAt: number }
  | { ok: false; problem: LocationProblem };

/** How long a fix is worth reusing before asking the device again. */
const FRESH_MS = 45_000;

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  // Generous: a cold GPS fix under a roof in a rural town regularly takes
  // longer than ten seconds, and a timeout reads to the person as a refusal.
  timeout: 20_000,
  maximumAge: FRESH_MS,
};

let cached: { position: Position; accuracyMeters: number; at: number } | null =
  null;

export function locationSupport(): "ok" | "insecure" | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  // Order matters: over http, Chrome removes `geolocation` altogether and
  // Safari keeps it and fails, so the insecure case has to be named first or
  // half the browsers would report the wrong reason.
  if (!window.isSecureContext) return "insecure";
  if (!navigator.geolocation) return "unsupported";
  return "ok";
}

function classify(error: GeolocationPositionError): LocationProblem {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.TIMEOUT) return "timeout";
  return "unavailable";
}

/**
 * Asks for a position. Call this straight from a click handler — nothing may
 * be awaited before it, or Safari will not show the prompt.
 */
export function requestPosition(
  options: PositionOptions = DEFAULT_OPTIONS,
): Promise<PositionResult> {
  const support = locationSupport();
  if (support !== "ok") {
    return Promise.resolve({ ok: false, problem: support });
  }

  if (cached && Date.now() - cached.at < FRESH_MS) {
    return Promise.resolve({
      ok: true,
      position: cached.position,
      accuracyMeters: cached.accuracyMeters,
      capturedAt: cached.at,
    });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (fix) => {
        const position = {
          lng: fix.coords.longitude,
          lat: fix.coords.latitude,
        };
        cached = {
          position,
          accuracyMeters: fix.coords.accuracy,
          at: fix.timestamp,
        };
        resolve({
          ok: true,
          position,
          accuracyMeters: fix.coords.accuracy,
          capturedAt: fix.timestamp,
        });
      },
      (error) => resolve({ ok: false, problem: classify(error) }),
      options,
    );
  });
}

/**
 * Warms a fix ahead of the button that needs it, without ever asking.
 *
 * Only when the permission is already granted: the first fix of a session is
 * the slow one, and paying for it while somebody is still typing the title of
 * their case is the difference between "Estoy aquí ahora" answering at once
 * and it spinning for fifteen seconds. Where the Permissions API is missing —
 * older Safari — this does nothing at all, because the only way to find out
 * would be to ask, and asking without a gesture is what iOS ignores.
 */
export function primePosition(): void {
  if (locationSupport() !== "ok") return;
  if (cached && Date.now() - cached.at < FRESH_MS) return;
  if (!navigator.permissions?.query) return;

  navigator.permissions
    .query({ name: "geolocation" })
    .then((status) => {
      if (status.state !== "granted") return;
      void requestPosition({ ...DEFAULT_OPTIONS, enableHighAccuracy: false });
    })
    .catch(() => {
      // A browser that rejects the query is one we know nothing about; the
      // button still works.
    });
}
