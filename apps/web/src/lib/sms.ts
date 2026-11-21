/**
 * Phone verification through Twilio Verify.
 *
 * Verify owns the whole code lifecycle — generation, delivery, expiry, attempt
 * counting and fraud controls — so the application never sees the code it
 * sends. Better Auth's phone plugin keeps its session and account logic; its
 * own generated code is never delivered when Verify is configured.
 *
 * Without Verify credentials, outside production only, the plugin's own code
 * is written to the server log (see `delivery.ts`), which is how a laptop
 * signs in with no provider account.
 */
import { logDeliveryAllowed } from "@/lib/delivery";
import { env } from "@/lib/env";
import { logInfo } from "@/lib/log";

const VERIFY_API = "https://verify.twilio.com/v2";
const REQUEST_TIMEOUT_MS = 10_000;

/** Raised when the provider cannot be reached or refuses the request. */
export class VerifyProviderError extends Error {
  constructor(readonly status: number) {
    super(`Twilio Verify request failed with status ${status}`);
    this.name = "VerifyProviderError";
  }
}

export function isVerifyConfigured(): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_VERIFY_SERVICE_SID,
  );
}

export function isDemoPhoneSignInEnabled(): boolean {
  return Boolean(
    env.LOCAL_DEMO_OTP &&
      env.LOCAL_DEMO_PHONES &&
      ((env.NODE_ENV === "development" &&
        new URL(env.APP_URL).hostname === "localhost") ||
        env.DEMO_DEPLOYMENT),
  );
}

/** Whether a phone sign-in code can reach the person at all. */
export function canDeliverSms(): boolean {
  return isVerifyConfigured() || logDeliveryAllowed();
}

async function verifyRequest(
  path: "Verifications" | "VerificationCheck",
  body: Record<string, string>,
): Promise<Response> {
  return fetch(
    `${VERIFY_API}/Services/${env.TWILIO_VERIFY_SERVICE_SID}/${path}`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(
          `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
        )}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
}

/** Starts a Spanish SMS verification for an E.164 number. */
export async function startPhoneVerification(to: string): Promise<void> {
  const response = await verifyRequest("Verifications", {
    To: to,
    Channel: "sms",
    Locale: "es",
  });
  // The body can echo the number; only the status is logged upstream.
  if (!response.ok) throw new VerifyProviderError(response.status);
}

/**
 * Whether Verify approves a code for a number.
 *
 * A wrong, expired or already used code is a normal `false`; a 404 is how
 * Verify reports a verification that no longer exists (expired, approved or
 * out of attempts), which is also a plain refusal. Anything else is a provider
 * failure and never becomes a sign-in.
 */
export async function checkPhoneVerification(
  to: string,
  code: string,
): Promise<boolean> {
  const response = await verifyRequest("VerificationCheck", {
    To: to,
    Code: code,
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new VerifyProviderError(response.status);
  const result = (await response.json()) as { status?: string };
  return result.status === "approved";
}

/** Development only: the code goes to the server log instead of a phone. */
export function logPhoneCode(to: string, text: string): void {
  if (!logDeliveryAllowed()) {
    throw new Error(
      "Phone verification is not configured (TWILIO_VERIFY_SERVICE_SID), and log delivery is off",
    );
  }
  logInfo("sms.code_logged", { to, message: text });
}
