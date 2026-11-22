"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { emailOTPClient, phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser-side auth: same origin, one-time codes and optional passkeys, no passwords. */
export const authClient = createAuthClient({
  plugins: [phoneNumberClient(), emailOTPClient(), passkeyClient()],
});
