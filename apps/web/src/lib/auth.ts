import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { catalogues } from "@ruta/shared/messages";
import { normalizePhone } from "@ruta/shared/phone";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { emailOTP } from "better-auth/plugins/email-otp";
import { phoneNumber } from "better-auth/plugins/phone-number";
import { twoFactor } from "better-auth/plugins/two-factor";
import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { db } from "@/db";
import { memberProfiles, verification } from "@/db/schema";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
import {
  consumeRollingRateLimit,
  getRequestClientKey,
  type RateLimitPolicy,
} from "@/lib/rate-limit";
import {
  checkPhoneVerification,
  isDemoPhoneSignInEnabled,
  isVerifyConfigured,
  logPhoneCode,
  startPhoneVerification,
} from "@/lib/sms";

/**
 * Two ways in, neither of them a password.
 *
 *   phone   the default. Everyone here has a number and can recite it. Twilio
 *           Verify sends and checks a Spanish SMS code, and the account is
 *           created on the first successful verification.
 *   email   the secondary route: a six-digit code by email, for a tourist or
 *           anyone without SMS at hand. Also creates the account.
 *
 * Passkeys stay available for staff on the web. No identity document is asked
 * for anywhere: a verified phone or email is what participation requires.
 *
 * Built on first use, not at import: `next build` imports every route module to
 * read its configuration, and constructing this eagerly would make the build
 * demand a database URL and a secret it has no business knowing.
 */

/** The domain phone-only accounts park their placeholder address on. */
const PHONE_EMAIL_DOMAIN = "telefono.rutacibao.local";

/** Native app schemes; the development build's only outside production. */
const NATIVE_ORIGINS = ["rutacibao://", "rutacibao-preview://"];
const DEVELOPMENT_NATIVE_ORIGINS = ["rutacibao-dev://"];

const OTP_COOLDOWN_MS = 60_000;
const HOUR_MS = 3_600_000;

const PHONE_COOLDOWN: RateLimitPolicy = {
  scope: "otp-phone-cooldown",
  limit: 1,
  windowMs: OTP_COOLDOWN_MS,
};
const PHONE_HOURLY: RateLimitPolicy = {
  scope: "otp-phone-hourly",
  limit: 5,
  windowMs: HOUR_MS,
};
const EMAIL_COOLDOWN: RateLimitPolicy = {
  scope: "otp-email-cooldown",
  limit: 1,
  windowMs: OTP_COOLDOWN_MS,
};
const EMAIL_HOURLY: RateLimitPolicy = {
  scope: "otp-email-hourly",
  limit: 5,
  windowMs: HOUR_MS,
};
const CLIENT_HOURLY: RateLimitPolicy = {
  scope: "otp-client-hourly",
  limit: 20,
  windowMs: HOUR_MS,
};

/** Whether an address is the internal stand-in of a phone-only account. */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(`@${PHONE_EMAIL_DOMAIN}`));
}

const translate = createTranslator({
  locale: "es",
  messages: catalogues.es,
  namespace: "auth",
});

/** A neutral name for a new account: never derived from a phone or email. */
function defaultDisplayName(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `${translate("defaultDisplayName")} ${suffix.join("")}`;
}

/**
 * Whether a host belongs to this machine or the network it is on.
 *
 * Used only in development, to trust the origin a browser request arrived
 * from when testing on a phone over the LAN.
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

/** The origins the app trusts for auth, in this environment. */
export function nativeAppOrigins(): string[] {
  return env.NODE_ENV === "production"
    ? NATIVE_ORIGINS
    : [...NATIVE_ORIGINS, ...DEVELOPMENT_NATIVE_ORIGINS];
}

async function enforce(
  identifier: string,
  policy: RateLimitPolicy,
): Promise<void> {
  const result = await consumeRollingRateLimit(identifier, policy);
  if (result.allowed) return;
  // The wait goes in the body for the apps and in `Retry-After` for HTTP.
  throw new APIError(
    "TOO_MANY_REQUESTS",
    {
      code: "OTP_RATE_LIMITED",
      message: "Too many codes requested. Try again later.",
      retryAfter: result.retryAfterSeconds,
    },
    { "Retry-After": String(result.retryAfterSeconds) },
  );
}

/** Two-factor endpoints that read, replace or remove an enrolled secret. */
const TWO_FACTOR_MANAGEMENT = new Set([
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/get-totp-uri",
  "/two-factor/generate-backup-codes",
]);

/**
 * With no passwords, Better Auth lets any session manage two-factor. Once an
 * account is enrolled that would let a stolen session read the secret or mint
 * recovery codes and pass the staff step-up, so after enrolment these are
 * refused and a reset goes through operations.
 */
function twoFactorLock(): BetterAuthPlugin {
  return {
    id: "ruta-two-factor-lock",
    hooks: {
      before: [
        {
          matcher: (context) => TWO_FACTOR_MANAGEMENT.has(context.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            if (session?.user.twoFactorEnabled) {
              throw new APIError("FORBIDDEN", {
                code: "TWO_FACTOR_ALREADY_ENROLLED",
              });
            }
          }),
        },
      ],
    },
  };
}

/**
 * Normalises phone numbers before the phone plugin sees them, and rate-limits
 * every code send before anything is generated or delivered.
 */
function otpGuards(): BetterAuthPlugin {
  return {
    id: "ruta-otp-guards",
    hooks: {
      before: [
        {
          matcher: (context) =>
            context.path === "/phone-number/send-otp" ||
            context.path === "/phone-number/verify" ||
            context.path === "/email-otp/send-verification-otp",
          handler: createAuthMiddleware(async (ctx) => {
            const body = (ctx.body ?? {}) as Record<string, unknown>;
            const headers = ctx.headers ?? new Headers();

            if (ctx.path === "/email-otp/send-verification-otp") {
              const email = String(body.email ?? "")
                .trim()
                .toLowerCase();
              if (isPlaceholderEmail(email)) {
                throw new APIError("BAD_REQUEST", { code: "INVALID_EMAIL" });
              }
              await enforce(email, EMAIL_COOLDOWN);
              await enforce(email, EMAIL_HOURLY);
              await enforce(getRequestClientKey(headers), CLIENT_HOURLY);
              return;
            }

            const phone = normalizePhone(String(body.phoneNumber ?? ""));
            if (!phone) {
              throw new APIError("BAD_REQUEST", {
                code: "INVALID_PHONE_NUMBER",
              });
            }
            if (ctx.path === "/phone-number/send-otp") {
              await enforce(phone, PHONE_COOLDOWN);
              await enforce(phone, PHONE_HOURLY);
              await enforce(getRequestClientKey(headers), CLIENT_HOURLY);
            }
            return { context: { body: { ...body, phoneNumber: phone } } };
          }),
        },
      ],
      after: [
        {
          // Phone-only accounts carry an internal placeholder address because
          // Better Auth requires one. It is not an address and never leaves.
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned;
            if (!returned || returned instanceof Response) return;
            if (typeof returned !== "object" || !hidesPlaceholder(returned))
              return;
            return ctx.json(scrubPlaceholder(returned));
          }),
        },
      ],
    },
  };
}

/** Arrays and plain records only: dates and other instances pass untouched. */
function isTraversable(value: unknown): value is object {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return true;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hidesPlaceholder(value: unknown, depth = 0): boolean {
  if (!isTraversable(value) || depth > 2) return false;
  if (Array.isArray(value))
    return value.some((item) => hidesPlaceholder(item, depth + 1));
  const record = value as Record<string, unknown>;
  if (typeof record.email === "string" && isPlaceholderEmail(record.email))
    return true;
  return Object.values(record).some((item) =>
    hidesPlaceholder(item, depth + 1),
  );
}

function scrubPlaceholder<T>(value: T, depth = 0): T {
  if (!isTraversable(value) || depth > 2) return value;
  if (Array.isArray(value))
    return value.map((item) => scrubPlaceholder(item, depth + 1)) as T;
  const record = { ...(value as Record<string, unknown>) };
  for (const [key, item] of Object.entries(record)) {
    record[key] =
      key === "email" && typeof item === "string" && isPlaceholderEmail(item)
        ? null
        : scrubPlaceholder(item, depth + 1);
  }
  return record as T;
}

function createAuth() {
  const appUrl = new URL(env.APP_URL);
  const isDevelopment = env.NODE_ENV === "development";
  const verifyConfigured = isVerifyConfigured();
  const demoPhones = new Set(
    (env.LOCAL_DEMO_PHONES ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  // Fictional numbers sign in with the fixed demo code on a laptop or on the
  // hosted demo (`DEMO_DEPLOYMENT`, a `demo.` host); never on the real service.
  const demoSignIn = isDemoPhoneSignInEnabled();

  return betterAuth({
    appName: "Ruta Cibao",
    secret: env.BETTER_AUTH_SECRET,
    // In development the base URL is whatever the request came in on, so the
    // same server answers `localhost` on the laptop and the LAN address on a
    // phone without either of them being configured.
    baseURL: isDevelopment ? undefined : env.BETTER_AUTH_URL,
    trustedOrigins: (request) => [
      appUrl.origin,
      ...nativeAppOrigins(),
      ...(isDevelopment ? [localNetworkOrigin(request)] : []),
    ],
    database: drizzleAdapter(db, { provider: "pg", usePlural: false }),

    emailAndPassword: { enabled: false },

    // Deleting an account is `me.requestDeletion`, which captures what has to be
    // cleaned up before anything is removed. Better Auth's own delete endpoint
    // would drop the user row first and orphan that work, so it stays off.
    user: { deleteUser: { enabled: false } },

    databaseHooks: {
      user: {
        create: {
          // Nothing is granted by signing up beyond the verified contact the
          // account was created with.
          after: async (created) => {
            await db
              .insert(memberProfiles)
              .values({
                userId: created.id,
                displayName: defaultDisplayName(),
              })
              .onConflictDoNothing();
          },
        },
      },
    },

    plugins: [
      otpGuards(),
      twoFactorLock(),
      phoneNumber({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        phoneNumberValidator: (value) => normalizePhone(value) === value,
        sendOTP: async ({ phoneNumber: to, code }) => {
          // Fictional, allowlisted local numbers sign in with a fixed code.
          // Keeps the plugin's own expiry, attempt limit and single use.
          if (demoSignIn && demoPhones.has(to)) {
            await db
              .update(verification)
              .set({ value: `${env.LOCAL_DEMO_OTP}:0` })
              .where(eq(verification.identifier, to));
            return;
          }
          if (verifyConfigured) {
            await startPhoneVerification(to);
            return;
          }
          logPhoneCode(to, translate("smsOtpBody", { code }));
        },
        // With Verify, Verify alone decides whether a code is right; the
        // plugin's generated code is never delivered or accepted. Demo phones
        // never reach Twilio.
        verifyOTP: verifyConfigured
          ? async ({ phoneNumber: to, code }) => {
              if (demoSignIn && demoPhones.has(to)) {
                return code === env.LOCAL_DEMO_OTP;
              }
              return checkPhoneVerification(to, code);
            }
          : undefined,
        // No separate sign-up screen: verifying the code is the registration.
        // Better Auth needs an email for the user row, so the account parks
        // on a domain that resolves nowhere and is never shown or mailed.
        signUpOnVerification: {
          getTempEmail: (value) =>
            `${value.replace(/\D/g, "")}@${PHONE_EMAIL_DOMAIN}`,
          getTempName: () => translate("defaultDisplayName"),
        },
      }),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp }) => {
          const body = translate("emailOtpBody", { code: otp });
          const ignore = translate("emailOtpIgnore");
          await sendEmail({
            to: email,
            subject: translate("emailOtpSubject"),
            text: `${body}\n\n${ignore}`,
            html: `<p>${body}</p><p>${ignore}</p>`,
          });
        },
      }),
      passkey({
        rpID: appUrl.hostname,
        rpName: "Ruta Cibao",
        origin: env.APP_URL,
      }),
      twoFactor({
        issuer: "Ruta Cibao",
        allowPasswordless: true,
        totpOptions: {
          allowPasswordless: true,
        },
        backupCodeOptions: {
          allowPasswordless: true,
          storeBackupCodes: "encrypted",
        },
      }),
      // Internal use only: `/api/auth/admin/*` is refused at the route.
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
