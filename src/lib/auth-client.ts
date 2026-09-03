"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { adminClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth. Same-origin, so it needs no base URL.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), passkeyClient(), adminClient()],
});

export const { signIn, signOut, useSession } = authClient;
