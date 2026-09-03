/**
 * Outbound email.
 *
 * Without a Resend key the message is written to the server log instead of
 * being sent. That is what local development and the offline demo want: sign-in
 * still works — you copy the link out of the terminal — with no account, no
 * key and no network.
 */
import { Resend } from "resend";
import { env } from "@/lib/env";

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

export async function sendEmail(message: Message): Promise<void> {
  const api = resend();

  if (!api) {
    console.info(
      `[mail] RESEND_API_KEY is not set, so nothing was sent.\n  to: ${message.to}\n  subject: ${message.subject}\n${message.text}`,
    );
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
