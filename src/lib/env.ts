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
