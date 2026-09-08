import { env } from "@/lib/env";

/**
 * Digital Asset Links: the site vouching for the Android app.
 *
 * A Trusted Web Activity only drops the browser chrome when Android can verify
 * that this origin and the installed app belong to the same publisher. It does
 * so by fetching this file and matching the package name and the SHA-256 of
 * the signing certificate against the APK. Without a match, the same app opens
 * as a Custom Tab with an address bar — still functional, visibly not an app.
 *
 * Built from configuration rather than checked in, because the fingerprint
 * belongs to whoever publishes the listing — the municipality, eventually —
 * and must be changeable without a code change. Unset means there is no
 * Android app yet, and the file honestly does not exist.
 */
export function GET(): Response {
  const fingerprints = env.ANDROID_SHA256_FINGERPRINTS?.split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (!env.ANDROID_PACKAGE_NAME || !fingerprints?.length) {
    return new Response(null, { status: 404 });
  }

  return Response.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: env.ANDROID_PACKAGE_NAME,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        // Android caches the verdict per install, but Play's link checker and
        // Bubblewrap's validator read it live; an hour is long enough for a
        // CDN and short enough to fix a typo the same afternoon.
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
