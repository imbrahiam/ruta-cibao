import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { magicLink } from "better-auth/plugins/magic-link";
import { phoneNumber } from "better-auth/plugins/phone-number";
import { db } from "@/db";
import { memberProfiles } from "@/db/schema";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { sendSms } from "@/lib/sms";

/**
 * Four ways in, none of them a password.
 *
 * Ordered by who is likely to use them, not by what is easiest to build:
 *
 *   phone      the default. Everyone here has a number and can recite it; not
 *              everyone has an email address they can open on the spot. A
 *              six-digit code by SMS, and the account is created on the first
 *              successful verification — there is no separate sign-up.
 *   email      the floor. Works with no SMS credit, on any device, anywhere,
 *              and is what a tourist or an official from another province will
 *              reach for.
 *   Google     one tap for anyone already signed in on the device, which on an
 *              Android phone is nearly everyone. Optional: without credentials
 *              the button is not rendered.
 *   passkey    the ceiling, for a phone that already has one. Offered only
 *              where the browser can actually complete the ceremony.
 *
 * None of them asks for a cédula. That is a separate, verified step, because
 * visitors have to be able to sign in too.
 *
 * Built on first use, not at import: `next build` imports every route module to
 * read its configuration, and constructing this eagerly would make the build
 * demand a database URL and a secret it has no business knowing.
 */

/** The domain the phone-only accounts park their placeholder address on. */
const PHONE_EMAIL_DOMAIN = "telefono.rutacibao.local";

/**
 * Whether a host belongs to this machine or the network it is on.
 *
 * Used only in development, to decide whether to trust the origin a request
 * arrived from. Testing on a real phone means loading the app from the
 * machine's LAN address, and a `baseURL` pinned to `localhost` would reject
 * every sign-in from it. Cross-site mutations are already refused by `proxy.ts`
 * on the Origin header, which is the check that actually protects the session.
 */
function isLocalNetworkHost(hostname: string): boolean {
  if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname))
    return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".localhost")) {
    return true;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

function localNetworkOrigin(request?: Request): string | null {
  const origin = request?.headers.get("origin");
  if (!origin) return null;

  try {
    return isLocalNetworkHost(new URL(origin).hostname) ? origin : null;
  } catch {
    return null;
  }
}

function createAuth() {
  const appUrl = new URL(env.APP_URL);
  const isDevelopment = env.NODE_ENV === "development";

  return betterAuth({
    appName: "Ruta Cibao",
    secret: env.BETTER_AUTH_SECRET,
    // In development the base URL is whatever the request came in on, so the
    // same server answers `localhost` on the laptop and the LAN address on a
    // phone without either of them being configured.
    baseURL: isDevelopment ? undefined : env.BETTER_AUTH_URL,
    trustedOrigins: isDevelopment
      ? (request) => [env.APP_URL, localNetworkOrigin(request)]
      : undefined,
    database: drizzleAdapter(db, { provider: "pg", usePlural: false }),

    emailAndPassword: { enabled: false },

    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : undefined,

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
                  created.name ||
                  (created.email.endsWith(`@${PHONE_EMAIL_DOMAIN}`)
                    ? "Vecino"
                    : created.email.split("@")[0]) ||
                  "Vecino",
              })
              .onConflictDoNothing();
          },
        },
      },
    },

    plugins: [
      phoneNumber({
        otpLength: 6,
        // Long enough to switch to the messages app, read the code and come
        // back on a phone that is doing three other things.
        expiresIn: 600,
        allowedAttempts: 5,
        phoneNumberValidator: (value) => normalizePhone(value) !== null,
        sendOTP: async ({ phoneNumber: to, code }) => {
          await sendSms({
            to,
            body: `Ruta Cibao: tu código es ${code}. Vence en 10 minutos. Si no lo pediste, ignora este mensaje.`,
          });
        },
        // No separate sign-up screen: verifying the code is the registration.
        // Better Auth needs an email address for the user row, so the number
        // parks on a domain that resolves nowhere and is never shown or mailed.
        signUpOnVerification: {
          getTempEmail: (value) =>
            `${value.replace(/\D/g, "")}@${PHONE_EMAIL_DOMAIN}`,
          getTempName: (value) => formatPhone(value),
        },
      }),
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
