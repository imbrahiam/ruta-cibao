import { Platform } from "react-native";
import { API_ORIGIN, APP_VARIANT } from "@/lib/config";

/**
 * Reports a handled failure to the server log.
 *
 * Deliberately fire and forget: a failed report must never become a second
 * failure. The message and stack are all that leave the device, plus the build
 * variant and the route. No identity, no location, no screen content.
 */
const seen = new Set<string>();

export function reportError(error: unknown, route?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  const key = `${route ?? ""}\0${message}`;
  if (seen.has(key)) return;
  seen.add(key);

  const payload = {
    message: message.slice(0, 500),
    ...(error instanceof Error && error.stack
      ? { stack: error.stack.slice(0, 4_000) }
      : {}),
    platform: Platform.OS,
    appVersion: APP_VARIANT,
    ...(route ? { route } : {}),
  };

  void fetch(`${API_ORIGIN}/api/client-errors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => undefined); // expected: a failing reporter must not throw or loop.
}
