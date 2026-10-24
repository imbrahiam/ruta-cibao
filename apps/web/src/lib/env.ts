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
 * Server-only. Client apps receive their public configuration at build time.
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

const serverSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.url(),

    DATABASE_URL: z.string().startsWith("postgres"),

    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    BETTER_AUTH_URL: z.url(),
    // Fictional, allowlisted local accounts only: a phone in LOCAL_DEMO_PHONES
    // signs in with LOCAL_DEMO_OTP. Refused in production.
    LOCAL_DEMO_OTP: optionalString().refine(
      (value) => !value || /^\d{6}$/.test(value),
      "must be six digits",
    ),
    LOCAL_DEMO_PHONES: optionalString(),

    // 32 bytes, hex-encoded. Encrypts personal data at rest and keys the
    // lookup hashes that make some of it searchable. Rotating it makes existing
    // ciphertext unreadable — see OPERATIONS.md.
    APP_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-f]{64}$/, "must be 64 hex characters"),

    // Email. Without a key, sign-in codes are written to the server log
    // instead of being sent (development only).
    RESEND_API_KEY: optionalString(),
    EMAIL_FROM: z.string().min(1).default("Ruta Cibao <onboarding@resend.dev>"),

    // Phone sign-in through Twilio Verify, which generates, delivers and
    // checks the code. Without these, development writes the code to the log.
    TWILIO_ACCOUNT_SID: optionalString(),
    TWILIO_AUTH_TOKEN: optionalString(),
    TWILIO_VERIFY_SERVICE_SID: optionalString(),

    // Whether a sign-in code may be written to the server log when no SMS or
    // email provider is configured. On by default outside production, which is
    // how development signs in with no provider accounts; set 0 to turn it
    // off. Refused in production: a code in the log is a way into somebody
    // else's account for anyone who can read the log.
    AUTH_LOG_DELIVERY: optionalString()
      .refine(
        (value) => value === undefined || value === "0" || value === "1",
        "must be 0 or 1",
      )
      .transform((value) => (value === undefined ? undefined : value === "1")),

    // Enhanced Expo Push security; local development keeps in-app delivery.
    EXPO_PUSH_ACCESS_TOKEN: optionalString(),

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

    // Where the worker reaches the web app (compose network address). Falls
    // back to APP_URL. Used to refresh public caches after a removal.
    INTERNAL_APP_URL: optionalString().pipe(z.url().optional()),

    // Set to 1 only when a reverse proxy you control sets X-Forwarded-For.
    // Trusting that header without one lets any client forge its own IP and
    // walk straight through the rate limiter.
    TRUSTED_PROXY: z
      .enum(["0", "1"])
      .default("0")
      .transform((value) => value === "1"),

    // A hosted demonstration (e.g. demo.rutacibao.com), not the real service:
    // the fictional LOCAL_DEMO_PHONES sign in with LOCAL_DEMO_OTP and seeded
    // demo staff skip TOTP, exactly as on a laptop. Real numbers and emails
    // still go through Twilio Verify and Resend. Only accepted on a `demo.`
    // host, so the real deployment cannot switch it on by accident.
    DEMO_DEPLOYMENT: z
      .enum(["0", "1"])
      .default("0")
      .transform((value) => value === "1"),
  })
  .superRefine((value, context) => {
    if (
      value.DEMO_DEPLOYMENT &&
      !new URL(value.APP_URL).hostname.startsWith("demo.")
    ) {
      context.addIssue({
        code: "custom",
        path: ["DEMO_DEPLOYMENT"],
        message: "only allowed when APP_URL is a demo. host",
      });
    }
    if (value.NODE_ENV !== "production") return;
    if (!value.EXPO_PUSH_ACCESS_TOKEN && !value.DEMO_DEPLOYMENT) {
      context.addIssue({
        code: "custom",
        path: ["EXPO_PUSH_ACCESS_TOKEN"],
        message: "required in production",
      });
    }
    if (
      (value.LOCAL_DEMO_OTP || value.LOCAL_DEMO_PHONES) &&
      !value.DEMO_DEPLOYMENT
    ) {
      context.addIssue({
        code: "custom",
        path: ["LOCAL_DEMO_OTP"],
        message: "local demo credentials are forbidden in production",
      });
    }
    if (value.AUTH_LOG_DELIVERY) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_LOG_DELIVERY"],
        message: "writing sign-in codes to the log is forbidden in production",
      });
    }
    const app = new URL(value.APP_URL);
    const auth = new URL(value.BETTER_AUTH_URL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(app.hostname);
    if (!local && app.protocol !== "https:")
      context.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "must use HTTPS in production",
      });
    if (auth.origin !== app.origin)
      context.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "must match APP_URL origin",
      });
    if (!local && value.S3_ENDPOINT.startsWith("http:"))
      context.addIssue({
        code: "custom",
        path: ["S3_ENDPOINT"],
        message: "presigned browser URLs must use HTTPS in production",
      });
    if (
      !local &&
      (value.S3_ACCESS_KEY_ID === "minioadmin" ||
        value.S3_SECRET_ACCESS_KEY === "minioadmin")
    )
      context.addIssue({
        code: "custom",
        path: ["S3_ACCESS_KEY_ID"],
        message: "replace development storage credentials",
      });
  })
  .transform((value) => ({
    ...value,
    AUTH_LOG_DELIVERY:
      value.AUTH_LOG_DELIVERY ?? value.NODE_ENV !== "production",
  }));

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/** Validates the environment once and returns it. Throws on anything invalid. */
export function serverEnv(): ServerEnv {
  if (cached) return cached;

  if (typeof window !== "undefined") {
    throw new Error("@/lib/env is server-only");
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
