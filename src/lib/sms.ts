/**
 * Outbound SMS.
 *
 * Without Twilio credentials the message is written to the server log instead
 * of being sent — the same bargain `mail.ts` strikes. Local development, the
 * offline demo and a jury on a laptop can all sign in by phone with no account,
 * no key and no network: the code is in the terminal.
 *
 * Twilio and not Firebase, since that question comes up: Firebase Cloud
 * Messaging delivers push notifications to an app that is already installed,
 * which cannot be how somebody signs in for the first time — and this project
 * already sends its own web push. Firebase Phone Auth does send SMS, but it
 * would put a second identity provider beside Better Auth for one message.
 * Twilio's trial credit covers the demo, its REST API needs no SDK, and
 * swapping providers means rewriting this file and nothing else.
 */
import { env } from "@/lib/env";

const TWILIO_API = "https://api.twilio.com/2010-04-01";
const REQUEST_TIMEOUT_MS = 10_000;

type Message = {
  /** E.164, as produced by `normalizePhone`. */
  to: string;
  body: string;
};

export function isSmsConfigured(): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM,
  );
}

export async function sendSms(message: Message): Promise<void> {
  if (!isSmsConfigured()) {
    console.info(
      `[sms] Twilio is not configured, so nothing was sent.\n  to: ${message.to}\n  ${message.body}`,
    );
    return;
  }

  const response = await fetch(
    `${TWILIO_API}/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(
          `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
        )}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: message.to,
        From: env.TWILIO_FROM ?? "",
        Body: message.body,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    // Twilio answers with a JSON body carrying its own error code; the status
    // alone does not say whether the number was wrong or the account is out of
    // credit, and the operator reading the log needs to know which.
    throw new Error(
      `Failed to send SMS: ${response.status} ${await response.text()}`,
    );
  }
}
