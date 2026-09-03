import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { magicLink } from "better-auth/plugins/magic-link";
import { db } from "@/db";
import { memberProfiles } from "@/db/schema";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";

/**
 * Two ways in, both without a password.
 *
 * Magic link is the floor: an email address is the least a rural user needs,
 * and there is no password to forget or reuse. Passkey is the ceiling for
 * anyone whose phone supports it. Neither asks for a cédula — that is a
 * separate onboarding step, because tourists must be able to sign in too.
 *
 * Built on first use, not at import: `next build` imports every route module to
 * read its configuration, and constructing this eagerly would make the build
 * demand a database URL and a secret it has no business knowing.
 */
function createAuth() {
  const appUrl = new URL(env.APP_URL);

  return betterAuth({
    appName: "Ruta Cibao",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "pg", usePlural: false }),

    emailAndPassword: { enabled: false },

    databaseHooks: {
      user: {
        create: {
          // Every account starts as a visitor. Becoming a citizen is an
          // explicit, verified step; nothing is granted by signing up.
          after: async (created) => {
            await db
              .insert(memberProfiles)
              .values({
                userId: created.id,
                tier: "visitor",
                displayName:
                  created.name || created.email.split("@")[0] || "Vecino",
              })
              .onConflictDoNothing();
          },
        },
      },
    },

    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendEmail({
            to: email,
            subject: "Tu acceso a Ruta Cibao",
            text: `Entra a Ruta Cibao con este enlace:\n\n${url}\n\nSi no lo pediste, ignora este correo.`,
            html: `<p>Entra a Ruta Cibao con este enlace:</p><p><a href="${url}">${url}</a></p><p>Si no lo pediste, ignora este correo.</p>`,
          });
        },
      }),
      passkey({
        rpID: appUrl.hostname,
        rpName: "Ruta Cibao",
        origin: env.APP_URL,
      }),
      admin(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Awaited<ReturnType<Auth["api"]["getSession"]>>;

let instance: Auth | undefined;

export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
