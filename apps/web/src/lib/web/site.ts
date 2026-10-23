/**
 * Public site configuration, read from `NEXT_PUBLIC_*` values.
 *
 * Next inlines these at build time, so each environment ships its own web
 * artifact. Store links are optional on purpose: until a listing or a test
 * distribution exists, the landing says "Próximamente" instead of linking to
 * a store page that is not there.
 */

function httpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function origin(value: string | undefined): string {
  try {
    return new URL(value ?? "").origin;
  } catch {
    return "http://localhost:3000";
  }
}

export const site = {
  /** The canonical origin, for metadata and share links. */
  origin: origin(process.env.NEXT_PUBLIC_APP_URL),
  iosUrl: httpsUrl(process.env.NEXT_PUBLIC_IOS_URL),
  androidUrl: httpsUrl(process.env.NEXT_PUBLIC_ANDROID_URL),
  sourceUrl: httpsUrl(process.env.NEXT_PUBLIC_SOURCE_URL),
} as const;

/** The scheme the native app registers; opens a shared target in the app. */
export const APP_SCHEME = "rutacibao";
