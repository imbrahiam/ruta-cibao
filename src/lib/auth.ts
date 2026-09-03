import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "@/db";
import { env } from "@/lib/env";

/**
 * Authentication is deliberately thin here: sign-in methods (magic link,
 * passkey) and the cédula verification step are layered on in the onboarding
 * work. This stays the single source of truth for auth tables — edit it and run
 * `bun run auth:generate` rather than editing the generated schema.
 *
 * Built on first use, not at import. `next build` imports every route module to
 * read its configuration, and constructing this eagerly would make the build
 * demand a database URL and a secret it has no business knowing.
 */
function createAuth() {
  return betterAuth({
    appName: "Ruta Cibao",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "pg", usePlural: false }),
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
export type Session = Awaited<ReturnType<Auth["api"]["getSession"]>>;
