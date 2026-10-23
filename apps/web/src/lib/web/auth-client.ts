"use client";

import { emailOTPClient, phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser-side auth: same origin, one-time codes only, no passwords. */
export const authClient = createAuthClient({
  plugins: [phoneNumberClient(), emailOTPClient()],
});
