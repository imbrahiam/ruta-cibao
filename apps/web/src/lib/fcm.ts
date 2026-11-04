/** FCM HTTP v1; credentials and provider response text never leave this module. */
import { sign } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";

export type FcmTicket =
  | { status: "ok"; id: string }
  | { status: "error"; code: string };

export function isFcmEnabled(): boolean {
  return Boolean(
    env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY,
  );
}

let cached: { value: string; expiresAt: number } | undefined;
let refreshing: Promise<string> | undefined;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" }),
    ).toString("base64url");
    const claims = Buffer.from(
      JSON.stringify({
        iss: env.FCM_CLIENT_EMAIL,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: issuedAt,
        exp: issuedAt + 3600,
      }),
    ).toString("base64url");
    const input = `${header}.${claims}`;
    const signature = sign(
      "RSA-SHA256",
      Buffer.from(input),
      (env.FCM_PRIVATE_KEY ?? "").replaceAll("\\n", "\n"),
    ).toString("base64url");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${input}.${signature}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("FCM authorization unavailable");
    const result = z
      .object({
        access_token: z.string().min(1),
        expires_in: z.number().positive(),
      })
      .parse(await response.json());
    cached = {
      value: result.access_token,
      expiresAt: Date.now() + result.expires_in * 1000,
    };
    return cached.value;
  })();
  try {
    return await refreshing;
  } finally {
    refreshing = undefined;
  }
}

const failure = z.object({
  error: z.object({
    status: z.string().optional(),
    details: z
      .array(
        z.object({ "@type": z.string(), errorCode: z.string().optional() }),
      )
      .optional(),
  }),
});
const codes = new Set([
  "UNREGISTERED",
  "SENDER_ID_MISMATCH",
  "QUOTA_EXCEEDED",
  "UNAVAILABLE",
  "INTERNAL",
  "UNAUTHENTICATED",
  "PERMISSION_DENIED",
  "INVALID_ARGUMENT",
]);

export async function sendToFcm(
  token: string,
  data: Record<string, string>,
  title: string,
  body: string,
): Promise<FcmTicket> {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FCM_PROJECT_ID ?? "")}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${await accessToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data,
            android: {
              priority: "high",
              ttl: "86400s",
              notification: {
                channel_id: "notifications",
                tag: data.notificationId,
              },
            },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const result: unknown = await response.json();
    if (response.ok) {
      const accepted = z.object({ name: z.string().min(1) }).safeParse(result);
      return accepted.success
        ? { status: "ok", id: accepted.data.name }
        : { status: "error", code: "FcmUnknownError" };
    }
    if (response.status === 401) cached = undefined;
    const parsed = failure.safeParse(result);
    const detail = parsed.success
      ? parsed.data.error.details?.find(
          (entry) =>
            entry["@type"] ===
            "type.googleapis.com/google.firebase.fcm.v1.FcmError",
        )?.errorCode
      : undefined;
    // INVALID_ARGUMENT on the envelope can be a payload/config error. Only a
    // typed FCM token failure is safe to use to retire the registration.
    if (detail === "INVALID_ARGUMENT")
      return { status: "error", code: "FcmInvalidToken" };
    const code =
      detail ?? (parsed.success ? parsed.data.error.status : undefined);
    return {
      status: "error",
      code: code && codes.has(code) ? `Fcm${code}` : "FcmUnknownError",
    };
  } catch {
    return { status: "error", code: "FcmUnavailable" };
  }
}
