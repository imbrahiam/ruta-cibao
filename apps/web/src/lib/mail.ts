/**
 * Outbound email.
 *
 * Without a Resend key the message is written to the server log instead of
 * being sent. That is what local development and the offline demo want: sign-in
 * still works — you copy the link out of the terminal — with no account, no
 * key and no network.
 */
import { Resend } from "resend";
import { logDeliveryAllowed } from "@/lib/delivery";
import { env } from "@/lib/env";
import { logInfo } from "@/lib/log";

let client: Resend | undefined;

function resend(): Resend | undefined {
  if (!env.RESEND_API_KEY) return undefined;
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

type Message = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Whether an address can receive mail at all.
 *
 * Accounts created by phone carry a placeholder address on a `.local` domain
 * (Better Auth needs one), and so do the demo accounts. Mailing those bounces,
 * and bounces are what get a sending domain marked as spam.
 */
export function isDeliverableAddress(address: string | null | undefined) {
  return Boolean(address) && !/\.local$/i.test(address ?? "");
}

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/** Whether a sign-in link can reach the person, by email or by the log. */
export function canDeliverEmail(): boolean {
  return isEmailConfigured() || logDeliveryAllowed();
}

export async function sendEmail(message: Message): Promise<void> {
  const api = resend();

  if (!api) {
    if (!logDeliveryAllowed()) {
      throw new Error(
        "Email is not configured (RESEND_API_KEY), and production never writes links to the log",
      );
    }
    logInfo("mail.code_logged", {
      to: message.to,
      subject: message.subject,
      message: message.text,
    });
    return;
  }

  const { error } = await api.emails.send({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
