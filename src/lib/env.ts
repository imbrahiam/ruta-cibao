/**
 * Environment configuration, validated on first use and cached.
 *
 * Everything the app can be pointed at lives here so the same image runs on a
 * VPS (docker compose) or on Railway with nothing but different env values.
 *
 * Validation is lazy on purpose. `next build` imports every route module, and
 * an eager check would force the build to carry placeholder secrets just to get
 * past import time. Instead nothing reads a value during the build, and
 * `instrumentation.ts` forces the check when the server actually boots — so a
 * misconfigured deployment still fails to start rather than failing a request.
 *
 * Server-only. Client code reads `publicEnv` from `@/lib/env.public`.
 */
import { z } from "zod";

/**
 * An optional setting.
 *
 * A variable present but empty (`RESEND_API_KEY=`) means the same thing as one
 * that was never set: not configured. Zod's `.optional()` only covers
 * `undefined`, so without this a blank line in .env fails the boot — which is
 * exactly what .env.example tells people to write.
 */
function optionalString() {
  return z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value === "" ? undefined : value))
    .optional();
}

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.url(),

  DATABASE_URL: z.string().startsWith("postgres"),

  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),

  JCE_API_URL: z.url(),
  JCE_API_KEY: z.string().min(1),
  JCE_USE_MOCK: z
    .enum(["0", "1"])
    .default("0")
    .transform((value) => value === "1"),

  // 32 bytes, hex-encoded. Encrypts cedulas and every other piece of personal
  // data at rest, and keys the blind index that makes them searchable.
  // Rotating it makes existing ciphertext unreadable — see OPERATIONS.md.
  APP_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "must be 64 hex characters"),

  // Email. Without a key, magic links are written to the server log instead of
  // being sent, which is what local development wants.
  RESEND_API_KEY: optionalString(),
  EMAIL_FROM: z.string().min(1).default("Ruta Cibao <onboarding@resend.dev>"),

  // The assistant's narrative layer. Optional by design: retrieval is local
  // and the answer falls back to a deterministic Spanish template, so the
  // platform costs nothing to run without this.
  ANTHROPIC_API_KEY: optionalString(),

  // Google sign-in. Optional: without a client id the button is not rendered
  // and the phone and email routes are unaffected.
  GOOGLE_CLIENT_ID: optionalString(),
  GOOGLE_CLIENT_SECRET: optionalString(),

  // SMS. A phone number is the default way into this app, so the sign-in code
  // has to arrive by text. Without Twilio credentials the code is written to
  // the server log instead, which is what development and the demo want.
  TWILIO_ACCOUNT_SID: optionalString(),
  TWILIO_AUTH_TOKEN: optionalString(),
  /** The Twilio number the code is sent from, in E.164. */
  TWILIO_FROM: optionalString(),

  // The Android app on Google Play is a Trusted Web Activity: Chrome, full
  // screen, pointed at this origin. Android only trusts it once this origin
  // publishes the app's package name and signing certificate at
  // /.well-known/assetlinks.json, which these two feed. Several fingerprints,
  // comma-separated, cover an upload key and Play's own signing key.
  ANDROID_PACKAGE_NAME: optionalString(),
  ANDROID_SHA256_FINGERPRINTS: optionalString(),

  // Web Push. Without a keypair, push notifications are disabled and the
  // in-app notification centre still works. Generate with: bunx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: optionalString(),
  VAPID_PRIVATE_KEY: optionalString(),
  VAPID_SUBJECT: z.string().min(1).default("mailto:soporte@rutacibao.do"),

  // Object storage. MinIO locally and on the VPS; any S3-compatible service
  // works, which is what lets the same image run on Railway with R2.
  S3_ENDPOINT: z.url().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("ruta-cibao"),
  S3_ACCESS_KEY_ID: z.string().default("minioadmin"),
  S3_SECRET_ACCESS_KEY: z.string().default("minioadmin"),
  /** MinIO needs path-style addressing; AWS and R2 do not. */
  S3_FORCE_PATH_STYLE: z
    .enum(["0", "1"])
    .default("1")
    .transform((value) => value === "1"),

  // imgproxy signs and resizes on the fly, so the app never stores thumbnails.
  // Without a key, images are served straight from storage at full size.
  IMGPROXY_URL: optionalString(),
  IMGPROXY_KEY: optionalString(),
  IMGPROXY_SALT: optionalString(),

  // Street geometry, for a traffic report that covers the road rather than a
  // point on it. OpenStreetMap through Overpass — the same project behind
  // address search above, free and with no key. Set it empty to turn the
  // feature off: reports then fall back to a point, which is still true.
  OVERPASS_URL: z
    .string()
    .default("https://overpass-api.de/api/interpreter")
    .transform((value) => value.trim()),

  // Address search. `none` keeps search working against the province's own
  // places and drops only street addresses.
  GEOCODER: z.enum(["nominatim", "none"]).default("nominatim"),
  NOMINATIM_URL: z.url().default("https://nominatim.openstreetmap.org"),

  // Background jobs. pg-boss keeps its queues in this same database, in its
  // own schema, so there is nothing extra to run or back up. Turn it off and
  // the work still happens — in-process, on the request that caused it — which
  // is what a single-container demo and `bun run dev` want.
  JOBS_ENABLED: z
    .enum(["0", "1"])
    .default("1")
    .transform((value) => value === "1"),
  JOBS_SCHEMA: z.string().min(1).default("pgboss"),

  // Set to 1 only when a reverse proxy you control sets X-Forwarded-For.
  // Trusting that header without one lets any client forge its own IP and
  // walk straight through the rate limiter.
  TRUSTED_PROXY: z
    .enum(["0", "1"])
    .default("0")
    .transform((value) => value === "1"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/** Validates the environment once and returns it. Throws on anything invalid. */
export function serverEnv(): ServerEnv {
  if (cached) return cached;

  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/env is server-only; use @/lib/env.public in client code",
    );
  }

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nSee .env.example.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Reads like a plain object; each access resolves through `serverEnv()`. */
export const env = new Proxy({} as ServerEnv, {
  get: (_target, key: string) => serverEnv()[key as keyof ServerEnv],
});
