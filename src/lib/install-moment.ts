/**
 * The moment the app has earned an install offer.
 *
 * Asking someone to install an app before it has done anything for them is
 * asking for trust at the point where there is least of it. So the offer
 * waits for a sign of value: a contribution sent or queued, or a place saved.
 * Whatever caused it calls `markInstallMoment()`; the offer on the map listens.
 *
 * Remembered in storage too, so a report sent from a form that then closed
 * the screen still earns the offer on the next visit to the map.
 */
const EARNED_KEY = "ruta-cibao:install-earned";
export const INSTALL_MOMENT_EVENT = "ruta-cibao:install-moment";

export function markInstallMoment(): void {
  try {
    window.localStorage.setItem(EARNED_KEY, "1");
  } catch {
    // Storage blocked: the event below still reaches an open map.
  }
  window.dispatchEvent(new Event(INSTALL_MOMENT_EVENT));
}

export function installMomentEarned(): boolean {
  try {
    return window.localStorage.getItem(EARNED_KEY) === "1";
  } catch {
    return false;
  }
}
